import { useState } from 'react'

type Props = {
  onFilesSelect: (files: File[]) => void
  disabled?: boolean
}

export function FileSelector({ onFilesSelect, disabled }: Props) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const files = Array.from(e.dataTransfer.files ?? [])
    if (files.length) onFilesSelect(files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if ((e.target as HTMLElement).id === 'zoop-drop-area') {
      setIsDragging(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length) onFilesSelect(files)
    e.target.value = ''
  }

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    width: '100%',
    minHeight: '200px',
    borderRadius: '6px',
    border: `2px dashed ${disabled ? '#333' : isDragging ? '#666' : '#444'}`,
    background: disabled ? '#0d0d0d' : isDragging ? '#111' : '#0d0d0d',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  }

  return (
    <label
      id="zoop-drop-area"
      style={labelStyle}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input type="file" style={{ display: 'none' }} onChange={handleChange} disabled={disabled} multiple />
      <span style={{ fontSize: '14px', color: '#888' }}>Drop file here or tap</span>
      <span style={{ fontSize: '12px', color: '#666', textAlign: 'center' }}>Multiple files supported (sent one after another)</span>
    </label>
  )
}
