import React from 'react';

// Keeps one broken view from blanking the whole app.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('View crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card empty-state">
          <div className="glyph">⚠</div>
          <div style={{ fontWeight: 600, color: 'var(--text-900)', marginBottom: '6px' }}>This view couldn't be displayed.</div>
          <div style={{ marginBottom: '14px' }}>{this.state.error.message}</div>
          <button className="btn btn-ghost" onClick={() => this.setState({ error: null })}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
