/**
 * Zoop – P2P File Sharing über Nostr
 * Login → Empfänger → Datei → Senden | Eingehende Anfragen
 */

import { useState, useEffect, useCallback } from 'react'
import { LoginButton } from './components/LoginButton'
import { FileSelector } from './components/FileSelector'
import { RecipientInput } from './components/RecipientInput'
import { TransferProgress } from './components/TransferProgress'
import { IncomingRequest, type IncomingRequestData } from './components/IncomingRequest'
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
  const [incomingOffers, setIncomingOffers] = useState<IncomingOffer[]>([])
  const [sendError, setSendError] = useState<string | null>(null)
  const [notificationsAsked, setNotificationsAsked] = useState(false)

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

        // Browser Notification API
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (!notificationsAsked && Notification.permission === 'default') {
            Notification.requestPermission().finally(() => {
              setNotificationsAsked(true)
            })
          }
          if (Notification.permission === 'granted') {
            new Notification('Zoop – neue Datei', {
              body: `Neue Datei von ${senderNpub.slice(0, 16)}… (${fileName})`,
            })
          }
        }

        setIncomingOffers((prev) => [
          ...prev,
          {
            eventId: event.id,
            senderPubkey: event.pubkey,
            senderNpub,
            fileName,
            fileSize,
            encryptedContent: event.content,
          },
        ])
      }
    )
    return unsub
  }, [user?.pubkey, subscribeToEvents])

  const handleSend = useCallback(async () => {
    if (!user || !selectedFile || !recipientNpub.trim()) {
      setSendError('Bitte Empfänger und Datei wählen.')
      return
    }
    setSendError(null)
    reset()
    let recipientHex: string
    try {
      recipientHex = npubToHex(recipientNpub.trim())
    } catch {
      setSendError('Ungültige npub.')
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
        setSendError('Event konnte nicht gesendet werden.')
        return
      }
      const unsub = subscribeToEvents(
        { kinds: [KIND_WEBRTC_ANSWER], '#e': [signed.id] },
        async (answerEvent: VerifiedEvent) => {
          unsub()
          try {
            const decrypted = await decryptFromSender(answerEvent.content, answerEvent.pubkey, secretKeyHex ?? undefined)
            const answer = JSON.parse(decrypted) as RTCSessionDescriptionInit
            peer.signal(answer)
            await new Promise<void>((resolve, reject) => {
              peer.on('connect', resolve)
              peer.on('error', reject)
            })
            await sendFile(peer, selectedFile)
          } catch (e) {
            setSendError(e instanceof Error ? e.message : 'Verbindung fehlgeschlagen')
          }
        }
      )
      setTimeout(() => unsub(), 35_000)
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'WebRTC oder Verbindung fehlgeschlagen.')
    }
  }, [user, selectedFile, recipientNpub, secretKeyHex, initiateConnection, publishEvent, subscribeToEvents, sendFile, reset])

  const handleAccept = useCallback(
    async (offer: IncomingOffer) => {
      setIncomingOffers((prev) => prev.filter((o) => o.eventId !== offer.eventId))
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
          peer.on('connect', resolve)
          peer.on('error', reject)
        })
        await receiveFile(peer, offer.fileName, offer.fileSize)
      } catch (e) {
        setSendError(e instanceof Error ? e.message : 'Annahme fehlgeschlagen')
      }
    },
    [acceptConnection, publishEvent, receiveFile, reset, secretKeyHex]
  )

  const handleReject = useCallback((offer: IncomingOffer) => {
    setIncomingOffers((prev) => prev.filter((o) => o.eventId !== offer.eventId))
  }, [])

  const incomingRequests: IncomingRequestData[] = incomingOffers.map((o) => ({
    requestEventId: o.eventId,
    senderPubkey: o.senderPubkey,
    senderNpub: o.senderNpub,
    fileName: o.fileName,
    fileSize: o.fileSize,
  }))

  const baseStyles = { minHeight: '100vh', background: '#fafafa', color: '#171717', padding: '20px' }
  const mainStyles = { maxWidth: '512px', margin: '0 auto', padding: '64px 16px 32px' }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100" style={baseStyles}>
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
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1" style={{ fontSize: '14px', color: '#71717a', marginTop: '4px' }}>
            P2P-Dateien über Nostr – keine Registrierung
          </p>
        </div>

        {!user ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-8 text-center" style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
            <p className="text-zinc-600 dark:text-zinc-400" style={{ color: '#525252', fontSize: '14px' }}>
              Bitte oben mit Nostr verbinden, um Dateien zu senden oder zu empfangen.
            </p>
          </div>
        ) : (
          <>
            <section style={{ marginTop: '24px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 500, color: '#71717a', marginBottom: '8px' }}>📤 Datei senden</h2>
              <RecipientInput
                value={recipientNpub}
                onChange={setRecipientNpub}
                placeholder="npub1… (Empfänger)"
              />
              <FileSelector
                onFilesSelect={(files) => {
                  // Aktuell wird eine Datei nach der anderen übertragen – nimm die erste.
                  setSelectedFile(files[0] ?? null)
                }}
                disabled={state === 'sending' || state === 'receiving' || state === 'connecting'}
              />
              {selectedFile && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                  Ausgewählt: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
              {(sendError || transferError) && (
                <p className="text-sm text-red-600 dark:text-red-400">{sendError ?? transferError}</p>
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
                Senden
              </button>
            </section>

            <section style={{ marginTop: '24px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 500, color: '#71717a', marginBottom: '8px' }}>📥 Eingehende Anfragen</h2>
              {incomingRequests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-600 p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  Keine neuen Anfragen
                </div>
              ) : (
                <ul className="space-y-3">
                  {incomingRequests.map((req) => (
                    <li key={req.requestEventId}>
                      <IncomingRequest
                        request={req}
                        onAccept={() => handleAccept(incomingOffers.find((o) => o.eventId === req.requestEventId)!)}
                        onReject={() => handleReject(incomingOffers.find((o) => o.eventId === req.requestEventId)!)}
                        disabled={state === 'receiving' || state === 'connecting'}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default App
