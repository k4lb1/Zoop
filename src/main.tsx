import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const LOAD_TIMEOUT_MS = 15000

function showError(title: string, message: string) {
  const rootEl = document.getElementById('root')
  if (!rootEl) return
  const escaped = message.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  rootEl.innerHTML = `
    <div style="padding:24px;font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;background:#fff;border:2px solid #dc2626;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
      <h1 style="font-size:20px;color:#b91c1c;margin:0 0 12px 0;">${title}</h1>
      <pre style="background:#fef2f2;color:#991b1b;padding:16px;border-radius:8px;overflow:auto;font-size:14px;margin:0;white-space:pre-wrap;word-break:break-all;">${escaped}</pre>
      <p style="font-size:14px;color:#525252;margin:16px 0 0 0;">Browser-Konsole (F12) für Details öffnen.</p>
    </div>
  `
}

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML = '<p style="padding:24px;font-family:system-ui;">Fehler: #root nicht gefunden.</p>'
} else {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('App-Lade-Timeout (15s). Bitte Konsole prüfen.')), LOAD_TIMEOUT_MS)
  })

  Promise.race([
    Promise.all([
      import('./ErrorBoundary').then((m) => m.ErrorBoundary),
      import('./App.tsx').then((m) => m.default),
    ]),
    timeoutPromise,
  ])
    .then(([ErrorBoundary, App]) => {
      if (!App) {
        showError('Zoop – Startfehler', 'App-Modul hat keinen default-Export.')
        return
      }
      if (!ErrorBoundary) {
        showError('Zoop – Startfehler', 'ErrorBoundary nicht geladen.')
        return
      }
      try {
        createRoot(rootEl).render(
          <StrictMode>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </StrictMode>,
        )
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        showError('Zoop – Startfehler (beim Rendern)', msg)
        console.error('Zoop render:', e)
      }
    })
    .catch((e) => {
      const msg = e instanceof Error ? e.message : String(e)
      showError('Zoop – Startfehler (beim Laden)', msg)
      console.error('Zoop load App:', e)
    })
}
