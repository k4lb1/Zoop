/**
 * Fortschrittsbalken während Upload/Download
 */

type Props = {
  progress: number
  state: 'idle' | 'connecting' | 'sending' | 'receiving' | 'done' | 'error'
  error?: string | null
  label?: string
}

const stateLabels: Record<string, string> = {
  idle: '',
  connecting: 'Verbinde…',
  sending: 'Sende…',
  receiving: 'Empfange…',
  done: 'Fertig',
  error: 'Fehler',
}

export function TransferProgress({ progress, state, error, label }: Props) {
  if (state === 'idle') return null

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">
          {label ?? stateLabels[state]}
        </span>
        {state !== 'connecting' && state !== 'error' && (
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {Math.round(progress)}%
          </span>
        )}
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className="h-full bg-orange-500 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
