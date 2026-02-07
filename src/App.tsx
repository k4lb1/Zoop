import { useState, useEffect, useCallback, useRef } from 'react'
import { LoginButton } from './components/LoginButton'
import { FileSelector } from './components/FileSelector'
import { RecipientInput } from './components/RecipientInput'
import { TransferProgress } from './components/TransferProgress'
import { useNostr } from './hooks/useNostr'
import { useWebRTC } from './hooks/useWebRTC'
import { useSignalingBridge, type IncomingOffer } from './hooks/useSignalingBridge'
import { KIND_WEBRTC_OFFER, KIND_ZOOP_FALLBACK, npubToHex, hexToNpub } from './utils/nostr'
import { decryptFromSender } from './utils/crypto'
import { parseFallbackPayload, decryptFile, importKeyAndIv } from './utils/fallback0x0'
import type { VerifiedEvent } from 'nostr-tools'

export type { IncomingOffer }

function App() {
  const { user, error, secretKeyHex, login, loginWithNsec, logout, isExtensionAvailable, relayStatus, toggleRelay, publishEvent, subscribeToEvents } = useNostr()
  const [usedFallback, setUsedFallback] = useState(false)
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
    setTransferState,
    reset,
  } = useWebRTC()

  const [recipientNpub, setRecipientNpub] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [logLines, setLogLines] = useState<string[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)
  const idleRef = useRef(true)
  const pendingOffersRef = useRef<IncomingOffer[]>([])
  const processedOfferIdsRef = useRef<Set<string>>(new Set())
  const processedFallbackIdsRef = useRef<Set<string>>(new Set())
  const fileDownloadRef = useRef<(file: Blob, fileName: string) => void>(() => {})

  const onLog = useCallback((message: string) => {
    setLogLines((prev) => [...prev.slice(-49), message])
  }, [])
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logLines])
  const { startSend: bridgeStartSend, fallbackSend: bridgeFallbackSend, acceptOffer: bridgeAcceptOffer } = useSignalingBridge({
    publishEvent,
    subscribeToEvents,
    secretKeyHex,
    userPubkey: user?.pubkey ?? null,
    initiateConnection,
    acceptConnection,
    handleSignal,
    sendFile,
    receiveFile,
    reset,
    onLog,
  })

  const handleAccept = useCallback(
    async (offer: IncomingOffer) => {
      try {
        await bridgeAcceptOffer(offer)
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e))
        const msg = err.message?.trim() || err.toString() || 'Connection failed'
        if (/close called|user-initiated abort/i.test(msg)) return
        onLog(`Error: ${msg}`)
        if (/connection timeout|peer connection timeout/i.test(msg)) {
          setSendError(msg)
        } else if (/ice connection failed/i.test(msg)) {
          setSendError(`${msg} Try another network or disable VPN/firewall.`)
        } else {
          setSendError(msg)
        }
      }
    },
    [bridgeAcceptOffer, onLog]
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

  const handleFileDownload = useCallback((file: Blob, fileName: string) => {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }, [])
  fileDownloadRef.current = handleFileDownload
  onFileReceived(handleFileDownload)

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

  useEffect(() => {
    if (!user?.pubkey) return
    const unsub = subscribeToEvents(
      { kinds: [KIND_ZOOP_FALLBACK], '#p': [user.pubkey], since: Math.floor(Date.now() / 1000) - 86400 },
      async (event: VerifiedEvent) => {
        if (!event?.content || !event?.pubkey || processedFallbackIdsRef.current.has(event.id)) return
        processedFallbackIdsRef.current.add(event.id)
        setUsedFallback(true)
        try {
          const decrypted = await decryptFromSender(event.content, event.pubkey, secretKeyHex ?? undefined)
          const payload = parseFallbackPayload(decrypted)
          const res = await fetch(payload.url)
          if (!res.ok) throw new Error(`Download failed: ${res.status}`)
          const ciphertext = await res.arrayBuffer()
          const { key, iv } = await importKeyAndIv(payload.keyBase64, payload.ivBase64)
          const plaintext = await decryptFile(ciphertext, key, iv)
          const blob = new Blob([plaintext])
          fileDownloadRef.current(blob, payload.fileName)
        } catch (err) {
          console.error('Fallback receive error:', err)
        }
      }
    )
    return unsub
  }, [user?.pubkey, subscribeToEvents])

  const handleSend = useCallback(async () => {
    if (!user || !selectedFile || !recipientNpub.trim()) {
      setSendError('Please choose recipient and file.')
      return
    }
    setSendError(null)
    setLogLines(['Starting send...'])
    let recipientHex: string
    try {
      recipientHex = npubToHex(recipientNpub.trim())
    } catch {
      setSendError('Invalid npub.')
      setLogLines((prev) => [...prev.slice(-49), 'Error: Invalid npub.'])
      return
    }
    try {
      await bridgeStartSend({ recipientHex, file: selectedFile })
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      console.error('Send flow error:', err)
      const msg = err.message?.trim() || err.toString() || 'Connection failed'
      setLogLines((prev) => [...prev.slice(-49), `Error: ${msg}`])
      const isConnectionFailure = /ice connection failed|webrtc did not connect|no answer from recipient|connection setup timeout|connection timeout|peer connection timeout/i.test(msg)
      if (isConnectionFailure) {
        setSendError(null)
        setTransferState('sending')
        setLogLines((prev) => [...prev.slice(-49), 'WebRTC failed, trying fallback...'])
        try {
          await bridgeFallbackSend({ recipientHex, file: selectedFile })
          setUsedFallback(true)
          setTransferState('done')
        } catch (e2) {
          const err2 = e2 instanceof Error ? e2 : new Error(String(e2))
          const errMsg = err2.message || 'Fallback send failed.'
          setSendError(errMsg)
          setLogLines((prev) => [...prev.slice(-49), `Fallback failed: ${errMsg}`])
          setTransferState('error')
        }
        return
      }
      if (/connection timeout|peer connection timeout|no response/i.test(msg)) {
        setSendError(msg)
      } else if (/ice connection failed/i.test(msg)) {
        setSendError(`${msg} Try another network or disable VPN/firewall.`)
      } else {
        setSendError(msg)
      }
      reset()
    }
  }, [user, selectedFile, recipientNpub, bridgeStartSend, bridgeFallbackSend, setTransferState, reset])

  const baseStyles = { minHeight: '100vh', background: '#0f0f0f', color: '#fafafa', padding: '20px' }
  const mainStyles = { maxWidth: '512px', margin: '0 auto', padding: '64px 16px 32px' }

  return (
    <div className="min-h-screen" style={baseStyles}>
      {user ? (
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
      ) : null}

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
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '12px' }}>
              <LoginButton
                user={user}
                error={error}
                onLogin={login}
                onLoginWithNsec={loginWithNsec}
                onLogout={logout}
                isExtensionAvailable={isExtensionAvailable}
                centered
              />
            </div>
            <div className="rounded-2xl p-8 text-center" style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
              <p style={{ color: '#a1a1aa', fontSize: '14px' }}>
                Connect with Nostr above to send or receive files.
              </p>
            </div>
          </>
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
              <div style={{ marginBottom: '16px' }}>
                <TransferProgress
                  progress={progress}
                  state={state}
                  error={transferError}
                  speedMbps={speedMbps}
                  etaSeconds={etaSeconds}
                  chunkIndex={chunkIndex}
                  totalChunks={totalChunks}
                />
              </div>
              <button
                type="button"
                onClick={handleSend}
                disabled={!recipientNpub.trim() || !selectedFile || state === 'sending' || state === 'connecting'}
                style={{ width: '100%', padding: '14px 16px', fontSize: '16px', fontWeight: 500, color: '#fff', background: '#7B3FF2', border: 'none', borderRadius: '12px', cursor: 'pointer' }}
              >
                Send
              </button>
              {logLines.length > 0 && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '10px 12px',
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    fontSize: '12px',
                    fontFamily: 'ui-monospace, monospace',
                    color: '#a1a1aa',
                    lineHeight: 1.4,
                  }}
                >
                  {logLines.map((line, i) => (
                    <div key={i} style={{ wordBreak: 'break-word' }}>{line}</div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              )}
            </section>

            <p style={{ fontSize: '14px', color: '#71717a', marginTop: '24px' }}>
              📥 Incoming files are accepted automatically and download when ready.
            </p>
            {(sendError || transferError) && (
              <p className="text-sm" style={{ color: '#ef4444', marginTop: '12px' }}>{sendError || transferError || 'Something went wrong.'}</p>
            )}
          </>
        )}

      {user && (relayStatus.length > 0 || usedFallback) && (
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
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={() => toggleRelay(r.url)}
                  style={{ width: '14px', height: '14px', margin: 0, cursor: 'pointer' }}
                />
                <span>{r.status === 'connected' ? '🟢' : '🔴'}</span>
                <span>{host}</span>
                <span style={{ color: r.status === 'connected' ? '#86efac' : '#f87171' }}>
                  {r.status === 'connected' && r.latencyMs != null ? `${r.latencyMs} ms` : r.enabled ? (r.status === 'failed' ? 'failed' : '—') : 'off'}
                </span>
              </span>
            )
          })}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="0x0.st fallback (used when WebRTC fails)">
            <span>{usedFallback ? '🟡' : '⚪'}</span>
            <span>0x0</span>
          </span>
        </footer>
      )}
      </main>
    </div>
  )
}

export default App
