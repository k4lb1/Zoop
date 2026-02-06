/**
 * Zoop – P2P File Sharing über Nostr
 * Login → Empfänger → Datei → Senden | Eingehende Anfragen
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { LoginButton } from './components/LoginButton'
import { FileSelector } from './components/FileSelector'
import { RecipientInput } from './components/RecipientInput'
import { TransferProgress } from './components/TransferProgress'
import { useNostr } from './hooks/useNostr'
import { useWebRTC } from './hooks/useWebRTC'
import { KIND_WEBRTC_OFFER, KIND_WEBRTC_ANSWER, npubToHex, hexToNpub } from './utils/nostr'
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
  const { user, error, secretKeyHex, login, loginWithNsec, logout, isExtensionAvailable, publishEvent, subscribeToEvents } = useNostr()
  const {
    progress,
    state,
    error: transferError,
    initiateConnection,
    acceptConnection,
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
        const { peer, answer } = await acceptConnection(webrtcOffer)
        const encryptedAnswer = await encryptForReceiver(JSON.stringify(answer), offer.senderPubkey, secretKeyHex ?? undefined)
        await publishEvent({
          kind: KIND_WEBRTC_ANSWER,
          content: encryptedAnswer,
          tags: [
            ['p', offer.senderPubkey],
            ['e', offer.eventId],
          ],
          created_at: Math.floor(Date.now() / 1000),
        })
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => {
            reject(new Error('Connection timeout. Sender may not have received the answer (check relays).'))
          }, 45_000)
          peer.on('connect', () => {
            clearTimeout(t)
            resolve()
          })
          peer.on('error', (err) => {
            clearTimeout(t)
            reject(err)
          })
        })
        await receiveFile(peer, offer.fileName, offer.fileSize)
      } catch (e) {
        setSendError(e instanceof Error ? e.message : 'Accept failed')
      }
    },
    [acceptConnection, publishEvent, receiveFile, reset, secretKeyHex]
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

        // Only show notification if permission already granted (requestPermission needs user gesture)
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
      const { peer, offer } = await initiateConnection()
      const encryptedOffer = await encryptForReceiver(JSON.stringify(offer), recipientHex, secretKeyHex ?? undefined)
      const signed = await publishEvent({
        kind: KIND_WEBRTC_OFFER,
        content: encryptedOffer,
        tags: [
          ['p', recipientHex],
          ['file-name', selectedFile.name],
          ['file-size', String(selectedFile.size)],
        ],
        created_at: Math.floor(Date.now() / 1000),
      })
      if (!signed) {
        setSendError('Could not publish event.')
        return
      }
      const offerId = signed.id
      const since = Math.floor(Date.now() / 1000) - 120
      const unsub = subscribeToEvents(
        { kinds: [KIND_WEBRTC_ANSWER], '#e': [offerId], since },
        async (answerEvent: VerifiedEvent) => {
          if (answerHandledRef.current === offerId) return
          answerHandledRef.current = offerId
          unsub()
          try {
            const decrypted = await decryptFromSender(answerEvent.content, answerEvent.pubkey, secretKeyHex ?? undefined)
            const answer = JSON.parse(decrypted) as RTCSessionDescriptionInit
            peer.signal(answer)
            await new Promise<void>((resolve, reject) => {
              const t = setTimeout(() => {
                reject(new Error('Peer connection timeout. Recipient may not have received the offer.'))
              }, 45_000)
              peer.on('connect', () => {
                clearTimeout(t)
                resolve()
              })
              peer.on('error', (err) => {
                clearTimeout(t)
                reject(err)
              })
            })
            await sendFile(peer, selectedFile)
          } catch (e) {
            setSendError(e instanceof Error ? e.message : 'Connection failed')
            reset()
          }
        }
      )
      setTimeout(() => {
        unsub()
        if (answerHandledRef.current !== offerId) {
          setSendError('No response from recipient (timeout).')
          reset()
        }
      }, 35_000)
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'WebRTC or connection failed.')
    }
  }, [user, selectedFile, recipientNpub, secretKeyHex, initiateConnection, publishEvent, subscribeToEvents, sendFile, reset])

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

      <main className="max-w-lg mx-auto px-4 pt-16 pb-8 space-y-8" style={mainStyles}>
        <div className="text-center" style={{ textAlign: 'center' }}>
          <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '24px', fontWeight: 'bold', color: '#7B3FF2' }}>
            ⚡ Zoop
          </h1>
          <p className="text-sm mt-1" style={{ fontSize: '14px', color: '#a1a1aa', marginTop: '4px' }}>
            P2P files over Nostr – no sign-up
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
                <p className="text-sm" style={{ color: '#ef4444' }}>{sendError ?? transferError}</p>
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
      </main>
    </div>
  )
}

export default App
