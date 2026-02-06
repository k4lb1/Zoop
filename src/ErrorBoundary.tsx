/**
 * Fängt Render-Fehler ab und zeigt sie an (statt weiße Seite).
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Zoop ErrorBoundary:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
            background: '#fafafa',
            color: '#171717',
          }}
        >
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Zoop – Fehler</h1>
          <pre
            style={{
              padding: 16,
              background: '#fef2f2',
              color: '#b91c1c',
              borderRadius: 8,
              overflow: 'auto',
              fontSize: 14,
            }}
          >
            {this.state.error.message}
          </pre>
          <p style={{ marginTop: 16, fontSize: 14, color: '#525252' }}>
            Bitte diese Meldung kopieren und dem Entwickler schicken. Browser-Konsole (F12) enthält oft mehr Infos.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
