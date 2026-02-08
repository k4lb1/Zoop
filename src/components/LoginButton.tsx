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
  centered?: boolean
}

const btn = { padding: '10px 16px', fontSize: '14px', fontWeight: 500, border: 'none', borderRadius: '6px', cursor: 'pointer' as const, fontFamily: 'inherit' }
const darkBorder = '#333'
const darkMuted = '#888'

export function LoginButton({ user, error, onLogin, onLoginWithNsec, onLogout, isExtensionAvailable, centered }: Props) {
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
    } catch {}
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
        <button type="button" onClick={onLogout} style={{ ...btn, color: '#fff', background: '#222', border: '1px solid #444' }}>
          Log out
        </button>
      </div>
    )
  }

  const align = centered ? 'center' : 'flex-end'
  const textAlign = centered ? 'center' : 'right'
  const buttonWidth = centered ? '100%' : undefined
  const maxWidth = centered ? '100%' : '260px'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align, gap: '8px', width: centered ? '100%' : undefined }}>
      {!isExtensionAvailable && (
        <p style={{ fontSize: '12px', color: '#f59e0b', maxWidth, width: centered ? '100%' : undefined, textAlign }}>
          No Nostr extension – use “Login with nsec” below or install Alby/nos2x.
        </p>
      )}
      <button
        type="button"
        onClick={onLogin}
        disabled={!isExtensionAvailable}
        style={{ ...btn, color: '#fff', background: '#222', border: '1px solid #444', opacity: isExtensionAvailable ? 1 : 0.5, width: buttonWidth }}
      >
        Connect with Nostr
      </button>

      <button
        type="button"
        onClick={() => setShowNsec((s) => !s)}
        style={{ ...btn, color: darkMuted, background: 'transparent', border: `1px solid ${darkBorder}`, fontSize: '12px', width: buttonWidth }}
      >
        {showNsec ? 'Hide nsec' : 'Login with nsec'}
      </button>

      {showNsec && (
        <form onSubmit={handleNsecSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: centered ? '100%' : '260px' }}>
          <input
            type="password"
            value={nsecInput}
            onChange={(e) => setNsecInput(e.target.value)}
            placeholder="nsec1…"
            autoComplete="off"
            style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: `1px solid ${darkBorder}`, background: '#0d0d0d', color: '#fff', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
          <button type="button" onClick={handleGenerateNsec} style={{ ...btn, color: darkMuted, background: 'transparent', border: `1px solid ${darkBorder}`, fontSize: '12px' }}>
            Generate new nsec
          </button>
          <button type="submit" style={{ ...btn, color: '#fff', background: '#222', border: '1px solid #444', fontSize: '13px' }}>
            Login with nsec
          </button>
          <p style={{ fontSize: '11px', color: darkMuted, margin: 0 }}>
            Only use on trusted sites. nsec is not stored.
          </p>
        </form>
      )}

      {error && <p style={{ fontSize: '12px', color: '#ef4444', maxWidth, width: centered ? '100%' : undefined, textAlign }}>{error}</p>}
    </div>
  )
}
