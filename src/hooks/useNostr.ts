import { useState, useCallback, useRef, useEffect } from 'react'
import { nip19, Relay, getPublicKey, finalizeEvent } from 'nostr-tools'
import { utils as nostrUtils } from 'nostr-tools'
import type { EventTemplate, VerifiedEvent } from 'nostr-tools'
import { DEFAULT_RELAYS } from '../utils/nostr'

declare global {
  interface Window {
    nostr?: {
      getPublicKey: () => Promise<string>
      signEvent: (event: EventTemplate) => Promise<VerifiedEvent>
      nip44Encrypt?: (recipientPubkey: string, plaintext: string) => Promise<string>
      nip44Decrypt?: (senderPubkey: string, ciphertext: string) => Promise<string>
    }
  }
}

export type NostrUser = {
  pubkey: string
  npub: string
}

export type RelayStatusItem = {
  url: string
  status: 'connected' | 'failed'
  latencyMs: number | null
}

export type UseNostrReturn = {
  user: NostrUser | null
  error: string | null
  secretKeyHex: string | null
  login: () => Promise<NostrUser | null>
  loginWithNsec: (nsec: string) => Promise<NostrUser | null>
  logout: () => void
  isExtensionAvailable: boolean
  relays: Relay[]
  relayStatus: RelayStatusItem[]
  publishEvent: (event: EventTemplate) => Promise<VerifiedEvent | null>
  subscribeToEvents: (filter: { kinds?: number[]; '#p'?: string[]; '#e'?: string[]; since?: number }, onEvent: (event: VerifiedEvent) => void) => () => void
}

const RELAY_URLS = [...DEFAULT_RELAYS]

export function useNostr(): UseNostrReturn {
  const [user, setUser] = useState<NostrUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const secretKeyRef = useRef<string | null>(null)
  const relaysRef = useRef<Relay[]>([])
  const [relays, setRelays] = useState<Relay[]>([])
  const [relayStatus, setRelayStatus] = useState<RelayStatusItem[]>([])

  const isExtensionAvailable = typeof window !== 'undefined' && !!window.nostr

  const login = useCallback(async (): Promise<NostrUser | null> => {
    setError(null)
    secretKeyRef.current = null
    if (!window.nostr) {
      setError('No Nostr extension (e.g. Alby/nos2x) found. Please install one.')
      return null
    }
    try {
      const pubkey = await window.nostr.getPublicKey()
      const npub = nip19.npubEncode(pubkey)
      setUser({ pubkey, npub })
      return { pubkey, npub }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Login failed'
      setError(msg)
      return null
    }
  }, [])

  const loginWithNsec = useCallback(async (nsec: string): Promise<NostrUser | null> => {
    setError(null)
    const raw = nsec.trim()
    if (!raw) {
      setError('Please enter nsec.')
      return null
    }
    try {
      const decoded = nip19.decode(raw)
      if (decoded.type !== 'nsec') {
        setError('Invalid nsec format.')
        return null
      }
      const secBytes = decoded.data as Uint8Array
      const pubkeyHex = getPublicKey(secBytes)
      const secretHex = nostrUtils.bytesToHex(secBytes)
      secretKeyRef.current = secretHex
      const npub = nip19.npubEncode(pubkeyHex)
      setUser({ pubkey: pubkeyHex, npub })
      return { pubkey: pubkeyHex, npub }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid nsec'
      setError(msg)
      return null
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setError(null)
    secretKeyRef.current = null
    relaysRef.current.forEach((r) => {
      try { r.close() } catch {}
    })
    relaysRef.current = []
    setRelays([])
    setRelayStatus([])
  }, [])

  const ensureRelays = useCallback(async (): Promise<Relay[]> => {
    if (relaysRef.current.length > 0) return relaysRef.current
    const connected: Relay[] = []
    const status: RelayStatusItem[] = []
    for (const url of RELAY_URLS) {
      const start = Date.now()
      try {
        const relay = await Relay.connect(url)
        connected.push(relay)
        status.push({ url, status: 'connected', latencyMs: Date.now() - start })
      } catch (err) {
        console.warn(`Relay ${url} failed:`, err)
        status.push({ url, status: 'failed', latencyMs: null })
      }
    }
    relaysRef.current = connected
    setRelays(connected)
    setRelayStatus(status)
    return connected
  }, [])

  useEffect(() => {
    if (user?.pubkey) ensureRelays()
  }, [user?.pubkey, ensureRelays])

  const publishEvent = useCallback(async (event: EventTemplate): Promise<VerifiedEvent | null> => {
    const secretHex = secretKeyRef.current
    if (secretHex) {
      try {
        const signed = finalizeEvent(event, nostrUtils.hexToBytes(secretHex))
        const r = await ensureRelays()
        await Promise.all(r.map((relay) => relay.publish(signed)))
        return signed
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Publish failed'
        setError(msg)
        return null
      }
    }
    if (!window.nostr) {
      setError('Nostr extension or nsec required.')
      return null
    }
    try {
      const signed = await window.nostr.signEvent(event)
      const r = await ensureRelays()
      await Promise.all(r.map((relay) => relay.publish(signed)))
      return signed
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Publish failed'
      setError(msg)
      return null
    }
  }, [ensureRelays])

  const subscribeToEvents = useCallback(
    (
      filter: { kinds?: number[]; '#p'?: string[]; '#e'?: string[]; since?: number },
      onEvent: (event: VerifiedEvent) => void
    ): (() => void) => {
      let closed = false
      const subs: { relay: Relay; sub: { close: () => void } }[] = []

      const run = async () => {
        const r = await ensureRelays()
        const fullFilter: { kinds?: number[]; '#p'?: string[]; '#e'?: string[]; since?: number } = {}
        if (filter.kinds?.length) fullFilter.kinds = filter.kinds
        if (filter['#p']?.length) fullFilter['#p'] = filter['#p']
        if (filter['#e']?.length) fullFilter['#e'] = filter['#e']
        if (filter.since != null) fullFilter.since = filter.since

        for (const relay of r) {
          if (closed) break
          const sub = relay.subscribe([fullFilter], {
            onevent: (ev) => {
              if (closed || !ev) return
              onEvent(ev as VerifiedEvent)
            },
          })
          subs.push({ relay, sub })
        }
      }
      run()

      return () => {
        closed = true
        subs.forEach(({ sub }) => sub.close())
      }
    },
    [ensureRelays]
  )

  return {
    user,
    error,
    secretKeyHex: user ? secretKeyRef.current : null,
    login,
    loginWithNsec,
    logout,
    isExtensionAvailable,
    relays,
    relayStatus,
    publishEvent,
    subscribeToEvents,
  }
}
