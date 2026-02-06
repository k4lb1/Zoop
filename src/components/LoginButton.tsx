/**
 * Login-Button für Nostr NIP-07 (Browser-Extension)
 */

import type { NostrUser } from '../hooks/useNostr'

type Props = {
  user: NostrUser | null
  error: string | null
  onLogin: () => void
  onLogout: () => void
  isExtensionAvailable: boolean
}

export function LoginButton({ user, error, onLogin, onLogout, isExtensionAvailable }: Props) {
  if (user) {
    return (
      <div className="flex flex-col items-center gap-2">
        <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[200px]" title={user.npub}>
          {user.npub.slice(0, 12)}…{user.npub.slice(-8)}
        </span>
        <button
          type="button"
          onClick={onLogout}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        >
          Abmelden
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {!isExtensionAvailable && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Nostr-Extension (Alby/nos2x) installieren, dann Seite neu laden.
        </p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="button"
        onClick={onLogin}
        disabled={!isExtensionAvailable}
        className="px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        Mit Nostr anmelden
      </button>
    </div>
  )
}
