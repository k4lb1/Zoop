/**
 * Empfänger-Eingabe (npub)
 */

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
      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition disabled:opacity-50"
      spellCheck={false}
    />
  )
}
