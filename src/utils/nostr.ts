/**
 * Nostr-Hilfsfunktionen für Zoop
 * Relays, Event-Typen, Publishing
 */

import { nip19, Relay } from 'nostr-tools'
import type { Event } from 'nostr-tools'

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.info',
  'wss://nos.lol',
] as const

export const KIND_FILE_OFFER = 22242
export const KIND_FILE_ANSWER = 22243
export const KIND_FILE_META = 22244

export type NostrFileOfferPayload = {
  type: 'offer'
  offer: RTCSessionDescriptionInit
  fileName: string
  fileSize: number
  fileType?: string
}

export type NostrFileAnswerPayload = {
  type: 'answer'
  answer: RTCSessionDescriptionInit
  requestEventId: string
}

export function parseNostrEvent(event: Event): unknown {
  try {
    const content = event.content
    return JSON.parse(content) as unknown
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
