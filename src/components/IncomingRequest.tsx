/**
 * Eingehende Datei-Anfrage (Anzeige + Akzeptieren/Ablehnen)
 */

type IncomingRequestData = {
  requestEventId: string
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

export function IncomingRequest({ request, onAccept, onReject, disabled }: Props) {
  return (
    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-3">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        <span className="font-medium text-gray-800 dark:text-gray-200">{request.fileName}</span>
        {' '}({formatSize(request.fileSize)})
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-500 truncate" title={request.senderNpub}>
        Von: {request.senderNpub.slice(0, 16)}…
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAccept}
          disabled={disabled}
          className="flex-1 px-3 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-50 transition"
        >
          Annehmen
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={disabled}
          className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition"
        >
          Ablehnen
        </button>
      </div>
    </div>
  )
}
