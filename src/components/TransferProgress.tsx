type Props = {
  progress: number
  state: 'idle' | 'connecting' | 'sending' | 'receiving' | 'done' | 'error'
  error?: string | null
  label?: string
  speedMbps?: number
  etaSeconds?: number | null
  chunkIndex?: number
  totalChunks?: number
}

const stateLabels: Record<string, string> = {
  connecting: 'Connecting…',
  sending: 'Sending…',
  receiving: 'Receiving…',
  done: 'Done',
  error: 'Error',
}

function formatEta(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds)) return '—'
  if (seconds < 1) return '< 1s'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

export function TransferProgress({ progress, state, error, label, speedMbps = 0, etaSeconds, chunkIndex = 0, totalChunks = 0 }: Props) {
  if (state === 'idle') return null

  return (
    <div style={{ width: '100%', marginTop: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', color: '#888', marginBottom: '4px' }}>
        <span>{label ?? stateLabels[state]}</span>
        {state !== 'connecting' && state !== 'error' && <span style={{ fontWeight: 500, color: '#fff' }}>{Math.round(progress)}%</span>}
      </div>
      <div style={{ height: '6px', width: '100%', background: '#222', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: '#555', transition: 'width 0.3s ease-out' }} />
      </div>
      {(state === 'sending' || state === 'receiving') && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '8px', fontSize: '12px', color: '#888', marginTop: '4px' }}>
          <span>{speedMbps > 0 ? `${speedMbps.toFixed(2)} MB/s` : '— MB/s'}</span>
          <span>{formatEta(etaSeconds)}</span>
          {totalChunks > 0 && <span>Chunk {Math.min(chunkIndex, totalChunks)}/{totalChunks}</span>}
        </div>
      )}
      {error && <p style={{ fontSize: '14px', color: '#dc2626', marginTop: '4px' }}>{error}</p>}
    </div>
  )
}
