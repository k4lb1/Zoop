/**
 * Zoop – P2P File Sharing über Nostr
 * Einfache UI: Login → Empfänger → Datei → Senden
 */

import { LoginButton } from './components/LoginButton'
import { FileSelector } from './components/FileSelector'
import { RecipientInput } from './components/RecipientInput'
import { TransferProgress } from './components/TransferProgress'
import { useNostr } from './hooks/useNostr'
import { useWebRTC } from './hooks/useWebRTC'

function App() {
  const { user, error, login, logout, isExtensionAvailable } = useNostr()
  const { progress, state, error: transferError } = useWebRTC()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col items-center justify-center p-4">
      <header className="absolute top-4 right-4">
        <LoginButton
          user={user}
          error={error}
          onLogin={login}
          onLogout={logout}
          isExtensionAvailable={isExtensionAvailable}
        />
      </header>

      <main className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-center text-orange-600 dark:text-orange-400">
          Zoop
        </h1>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          P2P-Dateien direkt über Nostr – keine Registrierung, nur Extension.
        </p>

        {!user ? (
          <p className="text-center text-gray-600 dark:text-gray-400">
            Bitte zuerst mit Nostr anmelden.
          </p>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Empfänger (npub)
              </label>
              <RecipientInput value="" onChange={() => {}} placeholder="npub1…" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Datei
              </label>
              <FileSelector onFileSelect={() => {}} />
            </div>
            <TransferProgress progress={progress} state={state} error={transferError} />
            {/* Platzhalter: eingehende Anfragen werden später hier gerendert */}
            {/* <IncomingRequest request={...} onAccept={...} onReject={...} /> */}
          </>
        )}
      </main>
    </div>
  )
}

export default App
