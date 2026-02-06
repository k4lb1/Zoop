/**
 * Eingehende Datei-Anfrage – Annehmen / Ablehnen (ohne lucide-react)
 */

export type IncomingRequestData = {
  requestEventId: string
  senderPubkey: string
  senderNpub: string
  fileName: string
  fileSize: number
  fileType?: string
}

type Props = {
  request: IncomingRequestData
  onAccept: () => void
  onReject: () => void
  disabled?: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const btn = { padding: '10px 12px', fontSize: '14px', fontWeight: 500, border: 'none', borderRadius: '8px', cursor: 'pointer' as const, flex: 1 }

export function IncomingRequest({ request, onAccept, onReject, disabled }: Props) {
  return (
    <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #333', background: '#1a1a1a', marginBottom: '12px' }}>
      <div style={{ marginBottom: '12px' }}>
        <p style={{ fontWeight: 500, color: '#fafafa', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{request.fileName}</p>
        <p style={{ fontSize: '14px', color: '#a1a1aa', margin: '4px 0 0 0' }}>{formatSize(request.fileSize)}</p>
        <p style={{ fontSize: '12px', color: '#71717a', margin: '4px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={request.senderNpub}>From: {request.senderNpub.slice(0, 14)}…</p>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" onClick={onAccept} disabled={disabled} style={{ ...btn, color: '#fff', background: '#7B3FF2', opacity: disabled ? 0.5 : 1 }}>Accept</button>
        <button type="button" onClick={onReject} disabled={disabled} style={{ ...btn, color: '#e4e4e7', background: '#27272a', opacity: disabled ? 0.5 : 1 }}>Reject</button>
      </div>
    </div>
  )
}
