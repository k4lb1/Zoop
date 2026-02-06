/**
 * Hook für Nostr NIP-07 Login und Relay-Publishing
 */

import { useState, useCallback } from 'react'
import { nip19 } from 'nostr-tools'

declare global {
  interface Window {
    nostr?: {
      getPublicKey: () => Promise<string>
      signEvent: (event: { kind: number; content: string; tags: string[][]; created_at: number }) => Promise<{ sig: string }>
    }
  }
}

export type NostrUser = {
  pubkey: string
  npub: string
}

export function useNostr() {
  const [user, setUser] = useState<NostrUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  const login = useCallback(async () => {
    setError(null)
    if (!window.nostr) {
      setError('Keine Nostr-Extension (z.B. Alby/nos2x) gefunden. Bitte installieren.')
      return null
    }
    try {
      const pubkey = await window.nostr.getPublicKey()
      const npub = hexToNpub(pubkey)
      setUser({ pubkey, npub })
      return { pubkey, npub }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Login fehlgeschlagen'
      setError(msg)
      return null
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setError(null)
  }, [])

  return { user, error, login, logout, isExtensionAvailable: typeof window !== 'undefined' && !!window.nostr }
}

function hexToNpub(hex: string): string {
  return nip19.npubEncode(hex)
}
