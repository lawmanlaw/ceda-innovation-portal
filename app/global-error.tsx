'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem 1rem', maxWidth: 560, margin: '0 auto' }}>
        <h1>Something went wrong</h1>
        <p>Nothing you entered has been lost. Please try again.</p>
        <p style={{ color: '#85736a', fontSize: 14 }}>Details: {error.message}{error.digest ? ` (${error.digest})` : ''}</p>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
