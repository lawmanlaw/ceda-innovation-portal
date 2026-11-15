// Small shared helpers

export function fmtDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-BW', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: 'Africa/Gaborone',
  }).format(new Date(iso));
}

// Turns database errors into plain sentences; never leaks internals
export function friendlyError(e: { message?: string; code?: string } | null | undefined) {
  if (!e) return null;
  const known = ['22023', '42501', 'P0002', '40001'];
  if (e.code && known.includes(e.code) && e.message) return e.message;
  if (e.message?.toLowerCase().includes('rate limit')) return 'Too many attempts. Please wait a minute and try again.';
  return 'Something went wrong. Please try again.';
}

// Only allow redirects to our own pages (blocks open redirects)
export function safeNext(next: string | null | undefined, fallback = '/app') {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
