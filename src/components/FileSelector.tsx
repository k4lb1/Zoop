/**
 * Send File Area – Drag & Drop, große klickbare Fläche
 * Unterstützt mehrere Dateien (mehrfacher Drop / Auswahl).
 */

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
    borderRadius: '16px',
    border: `2px dashed ${disabled ? '#d4d4d8' : isDragging ? '#7B3FF2' : 'rgba(123,63,242,0.5)'}`,
    background: disabled ? '#f4f4f5' : isDragging ? 'rgba(123,63,242,0.1)' : 'rgba(123,63,242,0.05)',
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
      <span style={{ fontSize: '48px' }}>📤</span>
      <span style={{ fontSize: '16px', fontWeight: 500, color: '#3f3f46' }}>Datei hier ablegen oder tippen</span>
      <span style={{ fontSize: '14px', color: '#71717a', textAlign: 'center' }}>Unterstützt mehrere Dateien (einzeln nacheinander senden)</span>
    </label>
  )
}
