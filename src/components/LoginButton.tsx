/**
 * LoginButton – Extension (Connect with Nostr) oder nsec eingeben
 */

import { useState } from 'react'
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

export function LoginButton({ user, error, onLogin, onLoginWithNsec, onLogout, isExtensionAvailable }: Props) {
  const [nsecInput, setNsecInput] = useState('')
  const [showNsec, setShowNsec] = useState(false)

  const handleNsecSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (nsecInput.trim()) {
      onLoginWithNsec(nsecInput.trim())
      setNsecInput('')
    }
  }

  if (user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '14px', color: '#71717a', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={user.npub}>
          {user.npub.slice(0, 10)}…{user.npub.slice(-8)}
        </span>
        <button type="button" onClick={onLogout} style={{ ...btn, color: '#3f3f46', background: '#f4f4f5' }}>
          Abmelden
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
      {!isExtensionAvailable && (
        <p style={{ fontSize: '12px', color: '#b45309', maxWidth: '260px', textAlign: 'right' }}>
          Keine Nostr-Extension – nutze unten „Mit nsec anmelden“ oder installiere Alby/nos2x.
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
        style={{ ...btn, color: '#71717a', background: 'transparent', border: '1px solid #d4d4d8', fontSize: '12px' }}
      >
        {showNsec ? 'nsec ausblenden' : 'Mit nsec anmelden'}
      </button>

      {showNsec && (
        <form onSubmit={handleNsecSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: '260px' }}>
          <input
            type="password"
            value={nsecInput}
            onChange={(e) => setNsecInput(e.target.value)}
            placeholder="nsec1…"
            autoComplete="off"
            style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '8px', border: '1px solid #d4d4d8', boxSizing: 'border-box' }}
          />
          <button type="submit" style={{ ...btn, color: '#fff', background: '#7B3FF2', fontSize: '13px' }}>
            Mit nsec anmelden
          </button>
          <p style={{ fontSize: '11px', color: '#a1a1aa', margin: 0 }}>
            Nur auf vertrauenswürdigen Seiten nutzen. nsec wird nicht gespeichert.
          </p>
        </form>
      )}

      {error && <p style={{ fontSize: '12px', color: '#dc2626', maxWidth: '260px', textAlign: 'right' }}>{error}</p>}
    </div>
  )
}
