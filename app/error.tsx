'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main"><div className="wrap card stack" style={{ maxWidth: 520, marginTop: '3rem' }}>
      <h1>Something went wrong</h1>
      <p className="muted">Nothing you entered has been lost. Please try again, and if it keeps happening, tell us through live chat.</p>
      <button className="btn" onClick={reset}>Try again</button>
    </div></main>
  );
}
