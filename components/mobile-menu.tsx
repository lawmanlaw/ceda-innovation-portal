'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

// Phone-only menu: one tidy row in the top bar, links in a sheet underneath.
// Built on <details> so it still opens without JavaScript.
export default function MobileMenu({ signedIn, start }: { signedIn: boolean; start: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  useEffect(() => { if (ref.current) ref.current.open = false; }, [path]);
  const close = () => { if (ref.current) ref.current.open = false; };
  return (
    <details ref={ref} className="mmenu">
      <summary aria-label="Menu"><span /><span /><span /></summary>
      <nav className="mmenu-sheet" aria-label="Main">
        <Link href="/challenges" onClick={close}>Challenges</Link>
        <Link href="/report" onClick={close}>Report a problem</Link>
        <Link href="/report/track" onClick={close}>Track a report</Link>
        <Link href="/help" onClick={close}>Help</Link>
        <Link href={signedIn ? '/app' : '/login'} onClick={close}>{signedIn ? 'My dashboard' : 'Sign in'}</Link>
        <Link className="btn" href={start} onClick={close}>Submit an idea</Link>
      </nav>
    </details>
  );
}
