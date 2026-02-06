/**
 * Hook für WebRTC P2P-Verbindung und Dateiübertragung
 */

import { useState, useCallback, useRef } from 'react'
import SimplePeer from 'simple-peer'

export type TransferState = 'idle' | 'connecting' | 'sending' | 'receiving' | 'done' | 'error'

export type UseWebRTCReturn = {
  progress: number
  state: TransferState
  error: string | null
  sendFile: (peer: SimplePeer.Instance, file: File) => Promise<void>
  receiveFile: (peer: SimplePeer.Instance, fileName: string, fileSize: number) => Promise<Blob | null>
  reset: () => void
}

export function useWebRTC(): UseWebRTCReturn {
  const [progress, setProgress] = useState(0)
  const [state, setState] = useState<TransferState>('idle')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef(false)

  const reset = useCallback(() => {
    abortRef.current = false
    setProgress(0)
    setState('idle')
    setError(null)
  }, [])

  const sendFile = useCallback(async (peer: SimplePeer.Instance, file: File) => {
    abortRef.current = false
    setState('connecting')
    setError(null)

    return new Promise<void>((resolve, reject) => {
      peer.on('connect', () => {
        setState('sending')
        const chunkSize = 16 * 1024
        let offset = 0
        const sendChunk = () => {
          if (abortRef.current) {
            setState('error')
            reject(new Error('Abgebrochen'))
            return
          }
          const end = Math.min(offset + chunkSize, file.size)
          const chunk = file.slice(offset, end)
          const reader = new FileReader()
          reader.onload = () => {
            try {
              peer.send(reader.result as ArrayBuffer)
              offset = end
              setProgress(file.size ? (offset / file.size) * 100 : 100)
              if (offset < file.size) {
                sendChunk()
              } else {
                setState('done')
                resolve()
              }
            } catch (e) {
              setState('error')
              setError(e instanceof Error ? e.message : 'Send error')
              reject(e)
            }
          }
          reader.readAsArrayBuffer(chunk)
        }
        sendChunk()
      })
      peer.on('error', (err) => {
        setState('error')
        setError(err.message)
        reject(err)
      })
    })
  }, [])

  const receiveFile = useCallback(
    (peer: SimplePeer.Instance, _fileName: string, fileSize: number): Promise<Blob | null> =>
      new Promise((resolve, reject) => {
        abortRef.current = false
        setState('receiving')
        setError(null)
        const chunks: ArrayBuffer[] = []
        let received = 0

        peer.on('data', (data: ArrayBuffer | Buffer) => {
          const buf = data instanceof ArrayBuffer ? data : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
          chunks.push(buf)
          received += buf.byteLength
          setProgress(fileSize ? (received / fileSize) * 100 : 100)
        })
        peer.on('close', () => {
          setState('done')
          if (chunks.length) {
            resolve(new Blob(chunks))
          } else {
            resolve(null)
          }
        })
        peer.on('error', (err) => {
          setState('error')
          setError(err.message)
          reject(err)
        })
      }),
    []
  )

  return { progress, state, error, sendFile, receiveFile, reset }
}
