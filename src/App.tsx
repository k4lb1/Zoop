import { useState, useEffect, useCallback, useRef } from 'react'
import { LoginButton } from './components/LoginButton'
import { FileSelector } from './components/FileSelector'
import { RecipientInput } from './components/RecipientInput'
import { TransferProgress } from './components/TransferProgress'
import { useNostr } from './hooks/useNostr'
import { useWebRTC } from './hooks/useWebRTC'
import { KIND_WEBRTC_OFFER, KIND_WEBRTC_ANSWER, KIND_WEBRTC_ICE_CANDIDATE, npubToHex, hexToNpub } from './utils/nostr'
import type { SignalData } from './hooks/useWebRTC'
import { encryptForReceiver, decryptFromSender } from './utils/crypto'
import type { VerifiedEvent } from 'nostr-tools'

export type IncomingOffer = {
  eventId: string
  senderPubkey: string
  senderNpub: string
  fileName: string
  fileSize: number
  encryptedContent: string
}

function App() {
  const { user, error, secretKeyHex, login, loginWithNsec, logout, isExtensionAvailable, relayStatus, publishEvent, subscribeToEvents } = useNostr()
  const {
    progress,
    state,
    error: transferError,
    initiateConnection,
    acceptConnection,
    handleSignal,
    sendFile,
    receiveFile,
    speedMbps,
    etaSeconds,
    chunkIndex,
    totalChunks,
    onFileReceived,
    reset,
  } = useWebRTC()

  const [recipientNpub, setRecipientNpub] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const answerHandledRef = useRef<string | null>(null)
  const idleRef = useRef(true)
  const pendingOffersRef = useRef<IncomingOffer[]>([])
  const processedOfferIdsRef = useRef<Set<string>>(new Set())

  const handleAccept = useCallback(
    async (offer: IncomingOffer) => {
      reset()
      try {
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
        const unsubIce = subscribeToEvents(
          {
            kinds: [KIND_WEBRTC_ICE_CANDIDATE],
            '#e': [offer.eventId],
            '#p': user?.pubkey ? [user.pubkey] : [],
            since: Math.floor(Date.now() / 1000) - 60,
          },
          async (ev: VerifiedEvent) => {
            if (!ev?.content || ev.pubkey !== offer.senderPubkey) return
            try {
              const dec = await decryptFromSender(ev.content, ev.pubkey, secretKeyHex ?? undefined)
              const data = JSON.parse(dec) as SignalData
              handleSignal(peer, data)
            } catch {}
          }
        )
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => {
            unsubIce()
            try {
              peer.destroy()
            } catch {}
            reject(new Error('Receiver: WebRTC connection did not establish within 60s. Try two different devices or another network. Check console (F12) for details.'))
          }, 60_000)
          peer.on('connect', () => {
            clearTimeout(t)
            unsubIce()
            resolve()
          })
          peer.on('error', (err) => {
            clearTimeout(t)
            unsubIce()
            try {
              peer.destroy()
            } catch {}
            reject(err)
          })
        })
        await receiveFile(peer, offer.fileName, offer.fileSize)
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e))
        console.error('Receiver WebRTC error:', err)
        const msg = err.message?.trim() || err.toString() || 'Connection failed'
        if (/connection timeout|peer connection timeout/i.test(msg)) {
          setSendError(msg)
        } else if (/ice connection failed/i.test(msg)) {
          setSendError(`${msg} Try another network or disable VPN/firewall.`)
        } else {
          setSendError(msg)
        }
      }
    },
    [user?.pubkey, acceptConnection, publishEvent, receiveFile, reset, secretKeyHex, subscribeToEvents, handleSignal]
  )

  const canAcceptRef = state === 'idle' || state === 'done' || state === 'error'
  useEffect(() => {
    idleRef.current = canAcceptRef
  }, [canAcceptRef])
  useEffect(() => {
    if (!idleRef.current || pendingOffersRef.current.length === 0) return
    const offer = pendingOffersRef.current.shift()
    if (!offer || processedOfferIdsRef.current.has(offer.eventId)) return
    processedOfferIdsRef.current.add(offer.eventId)
    handleAccept(offer)
  }, [state, handleAccept])

  onFileReceived(useCallback((file: Blob, fileName: string) => {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }, []))

  useEffect(() => {
    if (!user?.pubkey) return
    const unsub = subscribeToEvents(
      { kinds: [KIND_WEBRTC_OFFER], '#p': [user.pubkey] },
      (event: VerifiedEvent) => {
        if (!event?.content || !event?.pubkey || !Array.isArray(event?.tags)) return
        const fileName = event.tags.find((t) => t[0] === 'file-name')?.[1] ?? 'file'
        const fileSize = parseInt(event.tags.find((t) => t[0] === 'file-size')?.[1] ?? '0', 10)
        const senderNpub = hexToNpub(event.pubkey)
        const offer: IncomingOffer = {
          eventId: event.id,
          senderPubkey: event.pubkey,
          senderNpub,
          fileName,
          fileSize,
          encryptedContent: event.content,
        }

        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Zoop – new file', {
            body: `New file from ${senderNpub.slice(0, 16)}… (${fileName})`,
          })
        }

        if (processedOfferIdsRef.current.has(offer.eventId)) return
        processedOfferIdsRef.current.add(offer.eventId)

        if (idleRef.current) {
          handleAccept(offer)
        } else {
          if (!pendingOffersRef.current.some((o) => o.eventId === offer.eventId)) {
            pendingOffersRef.current.push(offer)
          }
        }
      }
    )
    return unsub
  }, [user?.pubkey, subscribeToEvents, handleAccept])

  const handleSend = useCallback(async () => {
    if (!user || !selectedFile || !recipientNpub.trim()) {
      setSendError('Please choose recipient and file.')
      return
    }
    setSendError(null)
    answerHandledRef.current = null
    reset()
    let recipientHex: string
    try {
      recipientHex = npubToHex(recipientNpub.trim())
    } catch {
      setSendError('Invalid npub.')
      return
    }
    try {
      let offerId: string | null = null
      let unsubAnswer: (() => void) | null = null
      const peer = await initiateConnection(async (signalData: SignalData) => {
        if ('type' in signalData && signalData.type === 'offer') {
          const encrypted = await encryptForReceiver(JSON.stringify(signalData), recipientHex, secretKeyHex ?? undefined)
          const signed = await publishEvent({
            kind: KIND_WEBRTC_OFFER,
            content: encrypted,
            tags: [
              ['p', recipientHex],
              ['file-name', selectedFile.name],
              ['file-size', String(selectedFile.size)],
            ],
            created_at: Math.floor(Date.now() / 1000),
          })
          if (!signed) return
          offerId = signed.id
          const since = Math.floor(Date.now() / 1000) - 120
          unsubAnswer = subscribeToEvents(
            { kinds: [KIND_WEBRTC_ANSWER, KIND_WEBRTC_ICE_CANDIDATE], '#e': [offerId!], since },
            async (ev: VerifiedEvent) => {
              if (!ev?.content || !ev?.pubkey) return
              try {
                const dec = await decryptFromSender(ev.content, ev.pubkey, secretKeyHex ?? undefined)
                const data = JSON.parse(dec) as SignalData
                handleSignal(peer, data)
                if (ev.kind === KIND_WEBRTC_ANSWER) answerHandledRef.current = offerId
            } catch {}
            }
          )
        } else if ('candidate' in signalData && offerId) {
          const encrypted = await encryptForReceiver(JSON.stringify(signalData), recipientHex, secretKeyHex ?? undefined)
          await publishEvent({
            kind: KIND_WEBRTC_ICE_CANDIDATE,
            content: encrypted,
            tags: [['p', recipientHex], ['e', offerId]],
            created_at: Math.floor(Date.now() / 1000),
          })
        }
      })
      await new Promise<void>((resolve, reject) => {
        const t35 = setTimeout(() => {
          if (answerHandledRef.current !== offerId) {
            unsubAnswer?.()
            setSendError('Sender: No answer from recipient within 90s. Check Nostr relay or that the recipient has the app open and is online.')
            reset()
            reject(new Error('No answer from recipient'))
          }
        }, 90_000)
        const t45 = setTimeout(() => {
          if (answerHandledRef.current === offerId) {
            unsubAnswer?.()
            try {
              peer.destroy()
            } catch {}
            reject(new Error('Sender: WebRTC did not connect within 45s (answer was received). Try two different devices or another network. Check console (F12) for details.'))
          }
        }, 45_000)
        const clearBoth = () => {
          clearTimeout(t35)
          clearTimeout(t45)
          unsubAnswer?.()
        }
        peer.on('connect', () => {
          clearBoth()
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
      await sendFile(peer, selectedFile)
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      console.error('Send flow error:', err)
      const msg = err.message?.trim() || err.toString() || 'Connection failed'
      if (/connection timeout|peer connection timeout|no response/i.test(msg)) {
        setSendError(msg)
      } else if (/ice connection failed/i.test(msg)) {
        setSendError(`${msg} Try another network or disable VPN/firewall.`)
      } else {
        setSendError(msg)
      }
      reset()
    }
  }, [user, selectedFile, recipientNpub, secretKeyHex, initiateConnection, publishEvent, subscribeToEvents, handleSignal, sendFile, reset])

  const baseStyles = { minHeight: '100vh', background: '#0f0f0f', color: '#fafafa', padding: '20px' }
  const mainStyles = { maxWidth: '512px', margin: '0 auto', padding: '64px 16px 32px' }

  return (
    <div className="min-h-screen" style={baseStyles}>
      <header className="absolute top-0 right-0 p-4 z-10" style={{ position: 'absolute', top: 0, right: 0, padding: '16px', zIndex: 10 }}>
        <LoginButton
          user={user}
          error={error}
          onLogin={login}
          onLoginWithNsec={loginWithNsec}
          onLogout={logout}
          isExtensionAvailable={isExtensionAvailable}
        />
      </header>

      <main className="max-w-lg mx-auto px-4 pt-16 pb-8 space-y-8" style={{ ...mainStyles, ...(user && relayStatus.length > 0 ? { paddingBottom: 48 } : {}) }}>
        <div className="text-center" style={{ textAlign: 'center' }}>
          <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '24px', fontWeight: 'bold', color: '#7B3FF2' }}>
            ⚡ Zoop
          </h1>
          <p className="text-sm mt-1" style={{ fontSize: '14px', color: '#a1a1aa', marginTop: '4px' }}>
            P2P files over Nostr
          </p>
        </div>

        {!user ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
            <p style={{ color: '#a1a1aa', fontSize: '14px' }}>
              Connect with Nostr above to send or receive files.
            </p>
          </div>
        ) : (
          <>
            <section style={{ marginTop: '24px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 500, color: '#a1a1aa', marginBottom: '8px' }}>📤 Send file</h2>
              <RecipientInput
                value={recipientNpub}
                onChange={setRecipientNpub}
                placeholder="npub1… (recipient)"
              />
              <FileSelector
                onFilesSelect={(files) => {
                  setSelectedFile(files[0] ?? null)
                }}
                disabled={state === 'sending' || state === 'receiving' || state === 'connecting'}
              />
              {selectedFile && (
                <p className="text-sm truncate" style={{ color: '#a1a1aa' }}>
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
              {(sendError || transferError) && (
                <p className="text-sm" style={{ color: '#ef4444' }}>{sendError || transferError || 'Something went wrong.'}</p>
              )}
              <TransferProgress
                progress={progress}
                state={state}
                error={transferError}
                speedMbps={speedMbps}
                etaSeconds={etaSeconds}
                chunkIndex={chunkIndex}
                totalChunks={totalChunks}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!recipientNpub.trim() || !selectedFile || state === 'sending' || state === 'connecting'}
                style={{ width: '100%', padding: '14px 16px', fontSize: '16px', fontWeight: 500, color: '#fff', background: '#7B3FF2', border: 'none', borderRadius: '12px', cursor: 'pointer' }}
              >
                Send
              </button>
            </section>

            <p style={{ fontSize: '14px', color: '#71717a', marginTop: '24px' }}>
              📥 Incoming files are accepted automatically and download when ready.
            </p>
          </>
        )}

      {user && relayStatus.length > 0 && (
        <footer
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '8px 12px',
            background: '#1a1a1a',
            borderTop: '1px solid #333',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: '#a1a1aa',
            zIndex: 5,
          }}
        >
          {relayStatus.map((r) => {
            const host = r.url.replace(/^wss:\/\//, '').replace(/^ws:\/\//, '').split('/')[0]
            return (
              <span key={r.url} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} title={r.url}>
                <span>{r.status === 'connected' ? '🟢' : '🔴'}</span>
                <span>{host}</span>
                <span style={{ color: r.status === 'connected' ? '#86efac' : '#f87171' }}>
                  {r.status === 'connected' && r.latencyMs != null ? `${r.latencyMs} ms` : r.status === 'failed' ? 'failed' : '—'}
                </span>
              </span>
            )
          })}
        </footer>
      )}
      </main>
    </div>
  )
}

export default App
