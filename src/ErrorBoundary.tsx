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
            fontFamily: 'ui-monospace, Menlo, Monaco, "Courier New", monospace',
            background: '#fafafa',
            color: '#171717',
          }}
        >
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Zoop – Error</h1>
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
            Copy this message for the developer. Browser console (F12) often has more details.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
