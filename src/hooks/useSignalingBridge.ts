import { useRef, useCallback, useEffect } from 'react'
import type SimplePeer from 'simple-peer'
import { KIND_WEBRTC_OFFER, KIND_WEBRTC_ANSWER, KIND_WEBRTC_ICE_CANDIDATE, KIND_ZOOP_FALLBACK } from '../utils/nostr'
import { encryptForReceiver, decryptFromSender } from '../utils/crypto'
import {
  encryptFile,
  uploadTo0x0,
  exportKeyAndIv,
  fallbackPayloadToJson,
} from '../utils/fallback0x0'
import type { SignalData } from './useWebRTC'
import type { VerifiedEvent } from 'nostr-tools'

export type IncomingOffer = {
  eventId: string
  senderPubkey: string
  senderNpub: string
  fileName: string
  fileSize: number
  encryptedContent: string
}

type PublishEvent = (event: {
  kind: number
  content: string
  tags: string[][]
  created_at: number
}) => Promise<{ id: string } | null>

type SubscribeToEvents = (
  filter: { kinds?: number[]; '#e'?: string[]; '#p'?: string[]; since?: number },
  onEvent: (ev: VerifiedEvent) => void
) => () => void

export type UseSignalingBridgeParams = {
  publishEvent: PublishEvent
  subscribeToEvents: SubscribeToEvents
  secretKeyHex: string | null
  userPubkey: string | null
  initiateConnection: (onSignal: (data: SignalData) => void) => Promise<SimplePeer.Instance>
  acceptConnection: (offer: RTCSessionDescriptionInit, onSignal: (data: SignalData) => void) => Promise<SimplePeer.Instance>
  handleSignal: (peer: SimplePeer.Instance, signal: SignalData) => void
  sendFile: (peer: SimplePeer.Instance, file: File) => Promise<void>
  receiveFile: (peer: SimplePeer.Instance, fileName: string, fileSize: number) => Promise<Blob | null>
  reset: () => void
  onLog?: (message: string) => void
}

export type UseSignalingBridgeReturn = {
  startSend: (params: { recipientHex: string; file: File }) => Promise<void>
  fallbackSend: (params: { recipientHex: string; file: File }) => Promise<void>
  acceptOffer: (offer: IncomingOffer) => Promise<void>
}

export function useSignalingBridge(params: UseSignalingBridgeParams): UseSignalingBridgeReturn {
  const {
    publishEvent,
    subscribeToEvents,
    secretKeyHex,
    userPubkey,
    initiateConnection,
    acceptConnection,
    handleSignal,
    sendFile,
    receiveFile,
    reset,
    onLog,
  } = params

  const peerRef = useRef<SimplePeer.Instance | null>(null)
  const answerHandledRef = useRef<string | null>(null)
  const incomingSignalQueueRef = useRef<SignalData[]>([])
  const activeUnsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      activeUnsubRef.current?.()
      activeUnsubRef.current = null
      const p = peerRef.current
      if (p && !p.destroyed) {
        try {
          p.destroy()
        } catch {}
        peerRef.current = null
      }
      incomingSignalQueueRef.current = []
    }
  }, [])

  const startSend = useCallback(
    async (params: { recipientHex: string; file: File }) => {
      const { recipientHex, file } = params
      reset()
      answerHandledRef.current = null
      onLog?.('Connecting (WebRTC)...')
      let offerId: string | null = null
      let unsubAnswer: (() => void) | null = null
      const signalErrorRef = { current: null as Error | null }
      const peer = await initiateConnection(async (signalData: SignalData) => {
        try {
          if ('type' in signalData && signalData.type === 'offer') {
            const encrypted = await encryptForReceiver(JSON.stringify(signalData), recipientHex, secretKeyHex ?? undefined)
            const signed = await publishEvent({
              kind: KIND_WEBRTC_OFFER,
              content: encrypted,
              tags: [
                ['p', recipientHex],
                ['file-name', file.name],
                ['file-size', String(file.size)],
              ],
              created_at: Math.floor(Date.now() / 1000),
            })
            if (!signed) return
            offerId = signed.id
            onLog?.('Offer sent, waiting for answer...')
            const since = Math.floor(Date.now() / 1000) - 120
            unsubAnswer = subscribeToEvents(
              { kinds: [KIND_WEBRTC_ANSWER, KIND_WEBRTC_ICE_CANDIDATE], '#e': [offerId!], since },
              async (ev: VerifiedEvent) => {
                if (!ev?.content || !ev?.pubkey) return
                try {
                  const dec = await decryptFromSender(ev.content, ev.pubkey, secretKeyHex ?? undefined)
                  const data = JSON.parse(dec) as SignalData
                  const p = peerRef.current
                  if (p) {
                    handleSignal(p, data)
                  } else {
                    incomingSignalQueueRef.current.push(data)
                  }
                  if (ev.kind === KIND_WEBRTC_ANSWER) answerHandledRef.current = offerId
                } catch {}
              }
            )
            activeUnsubRef.current = unsubAnswer
          } else if ('candidate' in signalData && offerId) {
            const encrypted = await encryptForReceiver(JSON.stringify(signalData), recipientHex, secretKeyHex ?? undefined)
            await publishEvent({
              kind: KIND_WEBRTC_ICE_CANDIDATE,
              content: encrypted,
              tags: [['p', recipientHex], ['e', offerId]],
              created_at: Math.floor(Date.now() / 1000),
            })
          }
        } catch (err) {
          signalErrorRef.current = err instanceof Error ? err : new Error(String(err))
          try {
            peerRef.current?.destroy()
          } catch {}
        }
      })
      if (signalErrorRef.current) {
        throw signalErrorRef.current
      }
      peerRef.current = peer
      for (const s of incomingSignalQueueRef.current) {
        handleSignal(peer, s)
      }
      incomingSignalQueueRef.current = []
      try {
        await new Promise<void>((resolve, reject) => {
          const t35 = setTimeout(() => {
            if (answerHandledRef.current !== offerId) {
              unsubAnswer?.()
              activeUnsubRef.current = null
              reject(new Error('Sender: No answer from recipient within 90s. Check Nostr relay or that the recipient has the app open and is online.'))
            }
          }, 90_000)
          const t60 = setTimeout(() => {
            if (answerHandledRef.current === offerId) {
              unsubAnswer?.()
              activeUnsubRef.current = null
              try {
                peer.destroy()
              } catch {}
              reject(new Error('Sender: WebRTC did not connect within 60s (answer was received). Try WiFi; some mobile networks block TURN. Or try two different devices. Check console (F12) for details.'))
            }
          }, 60_000)
          const clearBoth = () => {
            clearTimeout(t35)
            clearTimeout(t60)
            unsubAnswer?.()
            activeUnsubRef.current = null
          }
          peer.on('connect', () => {
            clearBoth()
            onLog?.('Connected, sending file...')
            resolve()
          })
          peer.on('error', (err) => {
            clearBoth()
            try {
              peer.destroy()
            } catch {}
            reject(err)
          })
        })
        onLog?.('Sending file...')
        await sendFile(peer, file)
        onLog?.('Done.')
      } finally {
        activeUnsubRef.current?.()
        activeUnsubRef.current = null
        peerRef.current = null
      }
    },
    [
      secretKeyHex,
      initiateConnection,
      publishEvent,
      subscribeToEvents,
      handleSignal,
      sendFile,
      reset,
      onLog,
    ]
  )

  const acceptOffer = useCallback(
    async (offer: IncomingOffer) => {
      reset()
      const decrypted = await decryptFromSender(offer.encryptedContent, offer.senderPubkey, secretKeyHex ?? undefined)
      const webrtcOffer = JSON.parse(decrypted) as RTCSessionDescriptionInit
      const peer = await acceptConnection(webrtcOffer, async (signalData: SignalData) => {
        const encrypted = await encryptForReceiver(JSON.stringify(signalData), offer.senderPubkey, secretKeyHex ?? undefined)
        const kind = 'type' in signalData && signalData.type === 'answer' ? KIND_WEBRTC_ANSWER : KIND_WEBRTC_ICE_CANDIDATE
        await publishEvent({
          kind,
          content: encrypted,
          tags: [
            ['p', offer.senderPubkey],
            ['e', offer.eventId],
          ],
          created_at: Math.floor(Date.now() / 1000),
        })
      })
      peerRef.current = peer
      for (const s of incomingSignalQueueRef.current) {
        handleSignal(peer, s)
      }
      incomingSignalQueueRef.current = []
      const unsubIce = subscribeToEvents(
        {
          kinds: [KIND_WEBRTC_ICE_CANDIDATE],
          '#e': [offer.eventId],
          '#p': userPubkey ? [userPubkey] : [],
          since: Math.floor(Date.now() / 1000) - 60,
        },
        async (ev: VerifiedEvent) => {
          if (!ev?.content || ev.pubkey !== offer.senderPubkey) return
          try {
            const dec = await decryptFromSender(ev.content, ev.pubkey, secretKeyHex ?? undefined)
            const data = JSON.parse(dec) as SignalData
            const p = peerRef.current
            if (p) {
              handleSignal(p, data)
            } else {
              incomingSignalQueueRef.current.push(data)
            }
          } catch {}
        }
      )
      activeUnsubRef.current = unsubIce
      try {
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => {
            unsubIce()
            activeUnsubRef.current = null
            try {
              peer.destroy()
            } catch {}
            reject(new Error('Receiver: WebRTC connection did not establish within 60s. Try two different devices or another network. Check console (F12) for details.'))
          }, 60_000)
          peer.on('connect', () => {
            clearTimeout(t)
            unsubIce()
            activeUnsubRef.current = null
            resolve()
          })
          peer.on('error', (err) => {
            const em = err?.message ?? ''
            if (/close called|user-initiated abort/i.test(em)) return
            clearTimeout(t)
            unsubIce()
            activeUnsubRef.current = null
            try {
              peer.destroy()
            } catch {}
            reject(err)
          })
        })
        await receiveFile(peer, offer.fileName, offer.fileSize)
      } finally {
        activeUnsubRef.current?.()
        activeUnsubRef.current = null
        try {
          if (!peer.destroyed) peer.destroy()
        } catch {}
        peerRef.current = null
      }
    },
    [
      secretKeyHex,
      userPubkey,
      acceptConnection,
      publishEvent,
      subscribeToEvents,
      handleSignal,
      receiveFile,
      reset,
    ]
  )

  const fallbackSend = useCallback(
    async (params: { recipientHex: string; file: File }) => {
      const { recipientHex, file } = params
      onLog?.('Encrypting file...')
      const { ciphertext, key, iv } = await encryptFile(file)
      onLog?.('Uploading (fallback)...')
      const blob = new Blob([ciphertext])
      const url = await uploadTo0x0(blob)
      const { keyBase64, ivBase64 } = await exportKeyAndIv(key, iv)
      const payload = fallbackPayloadToJson({
        url,
        fileName: file.name,
        fileSize: file.size,
        keyBase64,
        ivBase64,
      })
      const encrypted = await encryptForReceiver(payload, recipientHex, secretKeyHex ?? undefined)
      onLog?.('Sending link via Nostr...')
      const published = await publishEvent({
        kind: KIND_ZOOP_FALLBACK,
        content: encrypted,
        tags: [['p', recipientHex]],
        created_at: Math.floor(Date.now() / 1000),
      })
      if (!published) throw new Error('Could not publish fallback event.')
      onLog?.('Fallback done.')
    },
    [secretKeyHex, publishEvent, onLog]
  )

  return { startSend, fallbackSend, acceptOffer }
}
