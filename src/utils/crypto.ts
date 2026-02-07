import { nip44, utils as nostrUtils } from 'nostr-tools'

export async function encryptForReceiver(
  plaintext: string,
  receiverPublicKeyHex: string,
  senderSecretKeyHex?: string
): Promise<string> {
  if (typeof window !== 'undefined' && window.nostr?.nip44Encrypt) {
    return window.nostr.nip44Encrypt(receiverPublicKeyHex, plaintext)
  }
  if (!senderSecretKeyHex) throw new Error('NIP-44: Sender-Secret oder Extension nötig')
  const senderSecret = nostrUtils.hexToBytes(senderSecretKeyHex)
  const conversationKey = nip44.v2.utils.getConversationKey(senderSecret, receiverPublicKeyHex)
  return nip44.v2.encrypt(plaintext, conversationKey)
}

export async function decryptFromSender(
  ciphertext: string,
  senderPublicKeyHex: string,
  receiverSecretKeyHex?: string
): Promise<string> {
  if (typeof window !== 'undefined' && window.nostr?.nip44Decrypt) {
    return window.nostr.nip44Decrypt(senderPublicKeyHex, ciphertext)
  }
  if (!receiverSecretKeyHex) throw new Error('NIP-44: Empfänger-Secret oder Extension nötig')
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
