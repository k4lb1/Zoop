/**
 * LoginButton – Extension (Connect with Nostr) or nsec login, optional generate new nsec
 */

import { useState, useCallback } from 'react'
import { nip19 } from 'nostr-tools'
import { generateSecretKey } from 'nostr-tools/pure'
import type { NostrUser } from '../hooks/useNostr'

type Props = {
  user: NostrUser | null
  error: string | null
  onLogin: () => void
  onLoginWithNsec: (nsec: string) => void
  onLogout: () => void
  isExtensionAvailable: boolean
}

const btn = { padding: '10px 16px', fontSize: '14px', fontWeight: 500, border: 'none', borderRadius: '12px', cursor: 'pointer' as const }
const darkBorder = '#333'
const darkMuted = '#a1a1aa'

export function LoginButton({ user, error, onLogin, onLoginWithNsec, onLogout, isExtensionAvailable }: Props) {
  const [nsecInput, setNsecInput] = useState('')
  const [showNsec, setShowNsec] = useState(false)

  const handleGenerateNsec = useCallback(() => {
    const sk = generateSecretKey()
    const nsec = nip19.nsecEncode(sk)
    setNsecInput(nsec)
  }, [])

  const handleNsecSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (nsecInput.trim()) {
      onLoginWithNsec(nsecInput.trim())
      setNsecInput('')
    }
  }

  const copyNpub = useCallback(async () => {
    if (!user) return
    try {
      await navigator.clipboard.writeText(user.npub)
    } catch {
      /* ignore */
    }
  }, [user])

  if (user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '14px', color: darkMuted, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={user.npub}>
          {user.npub.slice(0, 10)}…{user.npub.slice(-8)}
        </span>
        <button type="button" onClick={copyNpub} style={{ ...btn, color: darkMuted, background: 'transparent', border: `1px solid ${darkBorder}`, fontSize: '12px' }} title="Copy npub">
          Copy npub
        </button>
        <button type="button" onClick={onLogout} style={{ ...btn, color: '#e4e4e7', background: '#27272a' }}>
          Log out
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
      {!isExtensionAvailable && (
        <p style={{ fontSize: '12px', color: '#f59e0b', maxWidth: '260px', textAlign: 'right' }}>
          No Nostr extension – use “Login with nsec” below or install Alby/nos2x.
        </p>
      )}
      <button
        type="button"
        onClick={onLogin}
        disabled={!isExtensionAvailable}
        style={{ ...btn, color: '#fff', background: '#7B3FF2', opacity: isExtensionAvailable ? 1 : 0.5 }}
      >
        Connect with Nostr (Extension)
      </button>

      <button
        type="button"
        onClick={() => setShowNsec((s) => !s)}
        style={{ ...btn, color: darkMuted, background: 'transparent', border: `1px solid ${darkBorder}`, fontSize: '12px' }}
      >
        {showNsec ? 'Hide nsec' : 'Login with nsec'}
      </button>

      {showNsec && (
        <form onSubmit={handleNsecSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: '260px' }}>
          <input
            type="password"
            value={nsecInput}
            onChange={(e) => setNsecInput(e.target.value)}
            placeholder="nsec1…"
            autoComplete="off"
            style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '8px', border: `1px solid ${darkBorder}`, background: '#1a1a1a', color: '#fafafa', boxSizing: 'border-box' }}
          />
          <button type="button" onClick={handleGenerateNsec} style={{ ...btn, color: darkMuted, background: 'transparent', border: `1px solid ${darkBorder}`, fontSize: '12px' }}>
            Generate new nsec
          </button>
          <button type="submit" style={{ ...btn, color: '#fff', background: '#7B3FF2', fontSize: '13px' }}>
            Login with nsec
          </button>
          <p style={{ fontSize: '11px', color: darkMuted, margin: 0 }}>
            Only use on trusted sites. nsec is not stored.
          </p>
        </form>
      )}

      {error && <p style={{ fontSize: '12px', color: '#ef4444', maxWidth: '260px', textAlign: 'right' }}>{error}</p>}
    </div>
  )
}
