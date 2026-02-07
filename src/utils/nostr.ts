import { nip19, Relay } from 'nostr-tools'
import type { Event, Filter } from 'nostr-tools'

export const DEFAULT_RELAYS = ['wss://nos.lol'] as const
export const KIND_WEBRTC_OFFER = 30333
export const KIND_WEBRTC_ANSWER = 30334
export const KIND_WEBRTC_ICE_CANDIDATE = 30335
export const KIND_ZOOP_FALLBACK = 30340

export type WebrtcOfferEventStructure = {
  kind: typeof KIND_WEBRTC_OFFER
  content: string
  tags: [
    ['p', string],
    ['file-name', string],
    ['file-size', string],
    ...string[][]
  ]
}

export type WebrtcAnswerEventStructure = {
  kind: typeof KIND_WEBRTC_ANSWER
  content: string
  tags: [
    ['p', string],
    ['e', string],
    ...string[][]
  ]
}

export function parseNostrEvent(event: Event): unknown {
  try {
    return JSON.parse(event.content) as unknown
  } catch {
    return null
  }
}

export async function connectRelays(urls: string[]): Promise<Relay[]> {
  const relays: Relay[] = []
  for (const url of urls) {
    try {
      const relay = await Relay.connect(url)
      relays.push(relay)
    } catch (err) {
      console.warn(`Relay ${url} failed:`, err)
    }
  }
  return relays
}

export function npubToHex(npub: string): string {
  const decoded = nip19.decode(npub)
  if (decoded?.type === 'npub') return decoded.data as string
  throw new Error('Invalid npub')
}

export function hexToNpub(hex: string): string {
  return nip19.npubEncode(hex)
}

export type { Event, Filter, Relay }
