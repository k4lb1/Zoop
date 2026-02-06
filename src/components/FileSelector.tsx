/**
 * Dateiauswahl mit Drag & Drop
 */

import { useCallback, useState } from 'react'

type Props = {
  onFileSelect: (file: File) => void
  disabled?: boolean
}

export function FileSelector({ onFileSelect, disabled }: Props) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled) return
      const file = e.dataTransfer.files?.[0]
      if (file) onFileSelect(file)
    },
    [onFileSelect, disabled]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) onFileSelect(file)
      e.target.value = ''
    },
    [onFileSelect]
  )

  return (
    <label
      className={`
        block w-full min-h-[140px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${isDragging ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30' : 'border-gray-300 dark:border-gray-600 hover:border-orange-400 dark:hover:border-orange-500'}
      `}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        type="file"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      <span className="text-4xl">📁</span>
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
        Datei hier ablegen oder klicken
      </span>
    </label>
  )
}
