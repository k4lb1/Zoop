const OX0_UPLOAD_URL = 'https://0x0.st'
const OX0_EXPIRES_HOURS = 24
const AES_GCM_IV_LENGTH = 12
const AES_KEY_LENGTH = 256

export async function uploadTo0x0(blob: Blob): Promise<string> {
  const form = new FormData()
  form.append('file', blob)
  form.append('expires', String(OX0_EXPIRES_HOURS))
  const res = await fetch(OX0_UPLOAD_URL, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`0x0 upload failed: ${res.status} ${text || res.statusText}`)
  }
  const url = (await res.text()).trim()
  if (!url.startsWith('http')) throw new Error('0x0 returned invalid URL')
  return url
}

export async function encryptFile(file: File): Promise<{ ciphertext: ArrayBuffer; key: CryptoKey; iv: Uint8Array }> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  )
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH))
  const plaintext = await file.arrayBuffer()
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    plaintext
  )
  return { ciphertext, key, iv }
}

export async function decryptFile(ciphertext: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    ciphertext
  )
}

export async function exportKeyAndIv(key: CryptoKey, iv: Uint8Array): Promise<{ keyBase64: string; ivBase64: string }> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return {
    keyBase64: btoa(String.fromCharCode(...new Uint8Array(raw))),
    ivBase64: btoa(String.fromCharCode(...iv)),
  }
}

export async function importKeyAndIv(keyBase64: string, ivBase64: string): Promise<{ key: CryptoKey; iv: Uint8Array }> {
  const keyBytes = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['decrypt']
  )
  const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0))
  return { key, iv }
}

export type FallbackPayload = {
  url: string
  fileName: string
  fileSize: number
  keyBase64: string
  ivBase64: string
}

export function fallbackPayloadToJson(p: FallbackPayload): string {
  return JSON.stringify(p)
}

export function parseFallbackPayload(json: string): FallbackPayload {
  const p = JSON.parse(json) as FallbackPayload
  if (!p?.url || !p?.fileName || typeof p?.fileSize !== 'number' || !p?.keyBase64 || !p?.ivBase64) {
    throw new Error('Invalid fallback payload')
  }
  return p
}
