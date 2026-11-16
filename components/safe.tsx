'use client';
import { Component } from 'react';

// Keeps a crash in one widget from taking down the whole page, and shows what went wrong
export default class Safe extends Component<{ children: React.ReactNode; label: string }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { console.error(`[${this.props.label}]`, err); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="widget-error" role="alert">
        <strong>{this.props.label} hit a problem</strong>
        <code>{this.state.err.message}</code>
        <button className="btn small" onClick={() => this.setState({ err: null })}>Try again</button>
      </div>
    );
  }
}
