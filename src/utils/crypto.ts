/**
 * NIP-44 kompatible Verschlüsselung für WebRTC-Signaling
 * Sender/Empfänger können Offer/Answer nur mit eigenem Schlüssel lesen.
 */

import { nip44, utils as nostrUtils } from 'nostr-tools'

export function encryptForReceiver(
  plaintext: string,
  senderSecretKeyHex: string,
  receiverPublicKeyHex: string
): string {
  const senderSecret = nostrUtils.hexToBytes(senderSecretKeyHex)
  const conversationKey = nip44.v2.utils.getConversationKey(senderSecret, receiverPublicKeyHex)
  return nip44.v2.encrypt(plaintext, conversationKey)
}

export function decryptFromSender(
  ciphertext: string,
  receiverSecretKeyHex: string,
  senderPublicKeyHex: string
): string {
  const receiverSecret = nostrUtils.hexToBytes(receiverSecretKeyHex)
  const conversationKey = nip44.v2.utils.getConversationKey(receiverSecret, senderPublicKeyHex)
  return nip44.v2.decrypt(ciphertext, conversationKey)
}

export function isNip44Available(): boolean {
  try {
    return typeof nip44?.v2?.encrypt === 'function'
  } catch {
    return false
  }
}
