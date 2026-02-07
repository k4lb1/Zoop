type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function RecipientInput({ value, onChange, placeholder = 'npub1…', disabled }: Props) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      spellCheck={false}
      style={{
        width: '100%',
        padding: '12px 16px',
        fontSize: '16px',
        borderRadius: '12px',
        border: '1px solid #333',
        background: '#1a1a1a',
        color: '#fafafa',
        boxSizing: 'border-box',
      }}
    />
  )
}
