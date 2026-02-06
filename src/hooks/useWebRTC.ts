/**
 * useWebRTC – simple-peer, STUN/TURN, DataChannel, 64KB Chunks, setup timeout 50s
 */

import { useState, useCallback, useRef } from 'react'
import SimplePeer from 'simple-peer'

const CHUNK_SIZE = 64 * 1024 // 64KB
const CONNECTION_TIMEOUT_MS = 65_000

const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'turn:freeturn.net:3478', username: 'free', credential: 'free' },
    { urls: 'turns:freeturn.net:5349', username: 'free', credential: 'free' },
  ],
}

export type TransferState = 'idle' | 'connecting' | 'sending' | 'receiving' | 'done' | 'error'

export type UseWebRTCReturn = {
  progress: number
  state: TransferState
  error: string | null
  speedMbps: number
  etaSeconds: number | null
  chunkIndex: number
  totalChunks: number
  initiateConnection: () => Promise<{ peer: SimplePeer.Instance; offer: RTCSessionDescriptionInit }>
  acceptConnection: (offer: RTCSessionDescriptionInit) => Promise<{ peer: SimplePeer.Instance; answer: RTCSessionDescriptionInit }>
  sendFile: (peer: SimplePeer.Instance, file: File) => Promise<void>
  receiveFile: (peer: SimplePeer.Instance, fileName: string, fileSize: number) => Promise<Blob | null>
  onFileReceived: (callback: (file: Blob, fileName: string) => void) => () => void
  reset: () => void
}

export function useWebRTC(): UseWebRTCReturn {
  const [progress, setProgress] = useState(0)
  const [state, setState] = useState<TransferState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [speedMbps, setSpeedMbps] = useState(0)
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null)
  const [chunkIndex, setChunkIndex] = useState(0)
  const [totalChunks, setTotalChunks] = useState(0)
  const fileReceivedCbRef = useRef<(file: Blob, fileName: string) => void>(() => {})
  const abortRef = useRef(false)
  const startedAtRef = useRef<number | null>(null)

  const reset = useCallback(() => {
    abortRef.current = false
    setProgress(0)
    setState('idle')
    setError(null)
    setSpeedMbps(0)
    setEtaSeconds(null)
    setChunkIndex(0)
    setTotalChunks(0)
    startedAtRef.current = null
  }, [])

  const onFileReceived = useCallback((callback: (file: Blob, fileName: string) => void) => {
    fileReceivedCbRef.current = callback
    return () => {
      fileReceivedCbRef.current = () => {}
    }
  }, [])

  const initiateConnection = useCallback((): Promise<{ peer: SimplePeer.Instance; offer: RTCSessionDescriptionInit }> => {
    setError(null)
    setState('connecting')
    return new Promise((resolve, reject) => {
      const peer = new SimplePeer({
        initiator: true,
        trickle: false,
        config: rtcConfig,
      })
      let settled = false
      const fail = (err: Error) => {
        if (settled) return
        settled = true
        clearTimeout(t)
        setState('error')
        setError(err.message)
        reject(err)
      }
      const onSignal = (data: RTCSessionDescriptionInit) => {
        if (data.type === 'offer') {
          if (settled) return
          settled = true
          clearTimeout(t)
          peer.removeListener('signal', onSignal)
          resolve({ peer, offer: data })
        }
      }
      peer.on('signal', onSignal)
      peer.on('error', fail)
      const t = setTimeout(() => {
        peer.destroy()
        fail(new Error('Connection setup timeout. TURN relay may be blocked – try another network or disable VPN.'))
      }, CONNECTION_TIMEOUT_MS)
    })
  }, [])

  const acceptConnection = useCallback((offer: RTCSessionDescriptionInit): Promise<{ peer: SimplePeer.Instance; answer: RTCSessionDescriptionInit }> => {
    setError(null)
    setState('connecting')
    return new Promise((resolve, reject) => {
      const peer = new SimplePeer({
        initiator: false,
        trickle: false,
        config: rtcConfig,
      })
      peer.signal(offer)
      let settled = false
      const done = (result: { peer: SimplePeer.Instance; answer: RTCSessionDescriptionInit }) => {
        if (settled) return
        settled = true
        clearTimeout(t)
        resolve(result)
      }
      const fail = (err: Error) => {
        if (settled) return
        settled = true
        clearTimeout(t)
        setState('error')
        setError(err.message)
        reject(err)
      }
      peer.on('signal', (data: RTCSessionDescriptionInit) => {
        if (data.type === 'answer') done({ peer, answer: data })
      })
      peer.on('error', fail)
      const t = setTimeout(() => {
        peer.destroy()
        fail(new Error('Connection setup timeout. TURN relay may be blocked – try another network or disable VPN.'))
      }, CONNECTION_TIMEOUT_MS)
    })
  }, [])

  const sendFile = useCallback(async (peer: SimplePeer.Instance, file: File) => {
    abortRef.current = false
    setState('connecting')
    setError(null)
    setSpeedMbps(0)
    setEtaSeconds(null)
    setChunkIndex(0)
    setTotalChunks(Math.ceil(file.size / CHUNK_SIZE))
    await new Promise<void>((resolve, reject) => {
      peer.on('connect', () => {
        setState('sending')
        resolve()
      })
      peer.on('error', reject)
    })
    setState('sending')
    startedAtRef.current = performance.now()
    let transferred = 0
    let index = 0
    let offset = 0
    while (offset < file.size && !abortRef.current) {
      const end = Math.min(offset + CHUNK_SIZE, file.size)
      const chunk = file.slice(offset, end)
      const buf = await chunk.arrayBuffer()
      peer.send(buf)
      offset = end
      transferred += buf.byteLength
      index += 1
      const p = file.size ? (offset / file.size) * 100 : 100
      setProgress(p)
      setChunkIndex(index)

      const startedAt = startedAtRef.current
      if (startedAt != null) {
        const elapsedSec = (performance.now() - startedAt) / 1000
        if (elapsedSec > 0) {
          const bytesPerSec = transferred / elapsedSec
          const mbps = bytesPerSec / (1024 * 1024)
          setSpeedMbps(mbps)
          const remainingBytes = file.size - transferred
          setEtaSeconds(bytesPerSec > 0 ? remainingBytes / bytesPerSec : null)
        }
      }
    }
    if (abortRef.current) {
      setState('error')
      setError('Cancelled')
      return
    }
    setState('done')
    try {
      peer.destroy()
    } catch {
      /* ignore */
    }
  }, [])

  const receiveFile = useCallback(
    (peer: SimplePeer.Instance, fileName: string, fileSize: number): Promise<Blob | null> =>
      new Promise((resolve, reject) => {
        abortRef.current = false
        setState('receiving')
        setError(null)
        setSpeedMbps(0)
        setEtaSeconds(null)
        setChunkIndex(0)
        setTotalChunks(Math.ceil(fileSize / CHUNK_SIZE))
        startedAtRef.current = performance.now()
        const chunks: ArrayBuffer[] = []
        let received = 0
        let index = 0
        peer.on('data', (data: ArrayBuffer | Buffer) => {
          const buf = data instanceof ArrayBuffer ? data : (data as Buffer).buffer.slice((data as Buffer).byteOffset, (data as Buffer).byteOffset + (data as Buffer).byteLength)
          chunks.push(buf)
          received += buf.byteLength
          index += 1
          const p = fileSize ? (received / fileSize) * 100 : 100
          setProgress(p)
          setChunkIndex(index)

          const startedAt = startedAtRef.current
          if (startedAt != null) {
            const elapsedSec = (performance.now() - startedAt) / 1000
            if (elapsedSec > 0) {
              const bytesPerSec = received / elapsedSec
              const mbps = bytesPerSec / (1024 * 1024)
              setSpeedMbps(mbps)
              const remainingBytes = fileSize - received
              setEtaSeconds(bytesPerSec > 0 ? remainingBytes / bytesPerSec : null)
            }
          }
        })
        peer.on('close', () => {
          setState('done')
          if (chunks.length) {
            const blob = new Blob(chunks)
            fileReceivedCbRef.current(blob, fileName)
            resolve(blob)
          } else resolve(null)
        })
        peer.on('error', (err) => {
          setState('error')
          setError(err.message)
          reject(err)
        })
      }),
    []
  )

  return {
    progress,
    state,
    error,
    speedMbps,
    etaSeconds,
    chunkIndex,
    totalChunks,
    initiateConnection,
    acceptConnection,
    sendFile,
    receiveFile,
    onFileReceived,
    reset,
  }
}
