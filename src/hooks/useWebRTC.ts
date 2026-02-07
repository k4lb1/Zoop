import { useState, useCallback, useRef } from 'react'
import SimplePeer from 'simple-peer'

const CHUNK_SIZE = 64 * 1024
const CONNECTION_TIMEOUT_MS = 65_000

const defaultRtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: ['turn:freeturn.net:3478?transport=udp', 'turn:freeturn.net:3478?transport=tcp', 'turns:freeturn.net:5349?transport=tcp'],
      username: 'free',
      credential: 'free',
    },
    { urls: 'stun:stun.stunprotocol.org:3478' },
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
}

function getRtcConfig(): RTCConfiguration {
  const username = (import.meta.env.VITE_METERED_TURN_USERNAME as string | undefined)?.trim()
  const credential = (import.meta.env.VITE_METERED_TURN_CREDENTIAL as string | undefined)?.trim()
  if (username && credential) {
    return {
      iceServers: [
        { urls: 'stun:stun.relay.metered.ca:80' },
        { urls: 'turn:standard.relay.metered.ca:80', username, credential },
        { urls: 'turn:standard.relay.metered.ca:80?transport=tcp', username, credential },
        { urls: 'turn:standard.relay.metered.ca:443', username, credential },
        { urls: 'turns:standard.relay.metered.ca:443?transport=tcp', username, credential },
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
    }
  }
  return defaultRtcConfig
}

async function getRtcConfigAsync(): Promise<RTCConfiguration> {
  return getRtcConfig()
}

export type TransferState = 'idle' | 'connecting' | 'sending' | 'receiving' | 'done' | 'error'

export type SignalData =
  | RTCSessionDescriptionInit
  | { type: 'candidate'; candidate: RTCIceCandidateInit }
  | { candidate: RTCIceCandidateInit }

export type UseWebRTCReturn = {
  progress: number
  state: TransferState
  error: string | null
  speedMbps: number
  etaSeconds: number | null
  chunkIndex: number
  totalChunks: number
  initiateConnection: (onSignal: (data: SignalData) => void) => Promise<SimplePeer.Instance>
  acceptConnection: (offer: RTCSessionDescriptionInit, onSignal: (data: SignalData) => void) => Promise<SimplePeer.Instance>
  handleSignal: (peer: SimplePeer.Instance, signal: SignalData) => void
  sendFile: (peer: SimplePeer.Instance, file: File) => Promise<void>
  receiveFile: (peer: SimplePeer.Instance, fileName: string, fileSize: number) => Promise<Blob | null>
  onFileReceived: (callback: (file: Blob, fileName: string) => void) => () => void
  setTransferState: (state: TransferState) => void
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

  const handleSignal = useCallback((peer: SimplePeer.Instance, signal: SignalData) => {
    try {
      const data =
        'candidate' in signal && signal.candidate && !('type' in signal && signal.type === 'candidate')
          ? { type: 'candidate' as const, candidate: signal.candidate }
          : signal
      peer.signal(data as Parameters<SimplePeer.Instance['signal']>[0])
    } catch (err) {
      console.error('Error handling signal:', err)
    }
  }, [])

  const initiateConnection = useCallback(async (onSignal: (data: SignalData) => void): Promise<SimplePeer.Instance> => {
    setError(null)
    setState('connecting')
    const config = await getRtcConfigAsync()
    return new Promise((resolve) => {
      const peer = new SimplePeer({
        initiator: true,
        trickle: true,
        config,
      })
      let settled = false
      const fail = (err: Error) => {
        if (settled) return
        settled = true
        clearTimeout(t)
        setState('error')
        setError(err.message)
        try {
          peer.destroy()
        } catch {}
      }
      peer.on('signal', (data: SignalData) => {
        onSignal(data)
      })
      peer.on('connect', () => {
        clearTimeout(t)
      })
      peer.on('error', (err: Error) => {
        if (/close called|user-initiated abort/i.test(err?.message ?? '')) return
        fail(err)
      })
      peer.on('iceStateChange', (iceState: RTCIceConnectionState) => {
        if (iceState === 'failed') {
          fail(new Error('ICE connection failed. On mobile/cellular try "Relay only" below or add ?relay=1 to the URL.'))
        }
      })
      const t = setTimeout(() => {
        fail(new Error('Connection setup timeout. Try another network or check NAT/firewall.'))
      }, CONNECTION_TIMEOUT_MS)
      resolve(peer)
    })
  }, [])

  const acceptConnection = useCallback(
    async (offer: RTCSessionDescriptionInit, onSignal: (data: SignalData) => void): Promise<SimplePeer.Instance> => {
      setError(null)
      setState('connecting')
      const config = await getRtcConfigAsync()
      return new Promise((resolve) => {
        const peer = new SimplePeer({
          initiator: false,
          trickle: true,
          config,
        })
        peer.signal(offer)
        let settled = false
        const fail = (err: Error) => {
          if (settled) return
          settled = true
          clearTimeout(t)
          setState('error')
          setError(err.message)
          try {
            peer.destroy()
          } catch {}
        }
        peer.on('signal', (data: SignalData) => {
          onSignal(data)
        })
        peer.on('connect', () => clearTimeout(t))
        peer.on('error', (err: Error) => {
          if (/close called|user-initiated abort/i.test(err?.message ?? '')) return
          fail(err)
        })
        peer.on('iceStateChange', (iceState: RTCIceConnectionState) => {
          if (iceState === 'failed') {
            fail(new Error('ICE connection failed. On mobile/cellular try "Relay only" below or add ?relay=1 to the URL.'))
          }
        })
        const t = setTimeout(() => {
          fail(new Error('Connection setup timeout. Try another network or check NAT/firewall.'))
        }, CONNECTION_TIMEOUT_MS)
        resolve(peer)
      })
    },
    []
  )

  const sendFile = useCallback(async (peer: SimplePeer.Instance, file: File) => {
    abortRef.current = false
    setState('connecting')
    setError(null)
    setSpeedMbps(0)
    setEtaSeconds(null)
    setChunkIndex(0)
    setTotalChunks(Math.ceil(file.size / CHUNK_SIZE))
    if (!peer.destroyed && !peer.connected) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 60_000)
        peer.on('connect', () => {
          clearTimeout(timeout)
          resolve()
        })
        peer.on('error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })
      })
    }
    setState('sending')
    startedAtRef.current = performance.now()
    let transferred = 0
    let index = 0
    let offset = 0
    while (offset < file.size && !abortRef.current && !peer.destroyed) {
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
      if (startedAt != null && (performance.now() - startedAt) / 1000 > 0) {
        const elapsedSec = (performance.now() - startedAt) / 1000
        const bytesPerSec = transferred / elapsedSec
        setSpeedMbps(bytesPerSec / (1024 * 1024))
        setEtaSeconds(bytesPerSec > 0 ? (file.size - transferred) / bytesPerSec : null)
      }
    }
    if (abortRef.current) {
      setState('error')
      setError('Cancelled')
      return
    }
    const drainDeadline = Date.now() + 15_000
    while (Date.now() < drainDeadline && !peer.destroyed) {
      const buffered = (peer as unknown as { bufferSize?: number }).bufferSize ?? 0
      if (buffered === 0) break
      await new Promise((r) => setTimeout(r, 100))
    }
    setState('done')
    try {
      peer.destroy()
    } catch {}
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
          const buf =
            data instanceof ArrayBuffer
              ? data
              : (data as Buffer).buffer.slice((data as Buffer).byteOffset, (data as Buffer).byteOffset + (data as Buffer).byteLength)
          chunks.push(buf)
          received += buf.byteLength
          index += 1
          setProgress(fileSize ? (received / fileSize) * 100 : 100)
          setChunkIndex(index)
          const startedAt = startedAtRef.current
          if (startedAt != null && (performance.now() - startedAt) / 1000 > 0) {
            const elapsedSec = (performance.now() - startedAt) / 1000
            const bytesPerSec = received / elapsedSec
            setSpeedMbps(bytesPerSec / (1024 * 1024))
            setEtaSeconds(bytesPerSec > 0 ? (fileSize - received) / bytesPerSec : null)
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
          const msg = err?.message ?? ''
          if (/close called|user-initiated abort/i.test(msg)) return
          setState('error')
          setError(msg)
          reject(err)
        })
      }),
    []
  )

  const setTransferState = useCallback((s: TransferState) => setState(s), [])

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
    handleSignal,
    sendFile,
    receiveFile,
    onFileReceived,
    setTransferState,
    reset,
  }
}
