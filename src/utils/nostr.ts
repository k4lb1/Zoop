/**
 * Nostr-Hilfsfunktionen für Zoop
 * Relays, Custom Event Kinds 30333/30334 für WebRTC-Signaling
 */

import { nip19, Relay } from 'nostr-tools'
import type { Event, Filter } from 'nostr-tools'

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
] as const

/** WebRTC-Offer von Sender an Empfänger */
export const KIND_WEBRTC_OFFER = 30333
/** WebRTC-Answer von Empfänger zurück an Sender */
export const KIND_WEBRTC_ANSWER = 30334

export type WebrtcOfferEventStructure = {
  kind: typeof KIND_WEBRTC_OFFER
  content: string // verschlüsselter WebRTC-Offer (NIP-44)
  tags: [
    ['p', string],       // recipient pubkey
    ['file-name', string],
    ['file-size', string],
    ...string[][]
  ]
}

export type WebrtcAnswerEventStructure = {
  kind: typeof KIND_WEBRTC_ANSWER
  content: string // verschlüsselter WebRTC-Answer (NIP-44)
  tags: [
    ['p', string],   // sender pubkey (Antwort an)
    ['e', string],   // request event id
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
