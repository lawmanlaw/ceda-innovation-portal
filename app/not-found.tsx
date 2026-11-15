import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main"><div className="wrap card stack" style={{ maxWidth: 520, marginTop: '3rem' }}>
      <h1>Page not found</h1>
      <p className="muted">The page may have moved, or you may not have access to it.</p>
      <Link className="btn" href="/app">Go to my dashboard</Link>
    </div></main>
  );
}
