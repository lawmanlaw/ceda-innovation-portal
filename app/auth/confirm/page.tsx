'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import Icon from '@/components/icon';

// Email links land here. The session arrives in the link, we store it, then go straight in.
export default function Confirm() {
  const router = useRouter();
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working');

  useEffect(() => {
    const sb = supabaseBrowser();
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    // Remove tokens from the address bar and history straight away
    window.history.replaceState(null, '', '/auth/confirm');

    (async () => {
      const type = hash.get('type') ?? query.get('type');
      let ok = false;
      if (hash.get('access_token') && hash.get('refresh_token')) {
        const { error } = await sb.auth.setSession({ access_token: hash.get('access_token')!, refresh_token: hash.get('refresh_token')! });
        ok = !error;
      } else if (query.get('code')) {
        const { error } = await sb.auth.exchangeCodeForSession(query.get('code')!);
        ok = !error;
      } else if (query.get('token_hash') && type) {
        const { error } = await sb.auth.verifyOtp({ token_hash: query.get('token_hash')!, type: type as 'email' });
        ok = !error;
      }
      if (!ok) return setState('failed');
      setState('done');
      setTimeout(() => {
        router.replace(type === 'recovery' ? '/reset-password' : '/app');
        router.refresh();
      }, 900);
    })();
  }, [router]);

  return (
    <main id="main">
      <div className="wrap card" style={{ maxWidth: 440, marginTop: '4rem' }}>
        {state === 'working' && <div className="loader" style={{ minHeight: 200 }}><img src="/ceda-mark.png" alt="" width={96} height={50} /><div className="loader-track"><span /></div></div>}
        {state === 'done' && (
          <div className="success" role="status">
            <Icon name="check" className="tick" />
            <strong>Your email is confirmed</strong>
            <span className="muted">Signing you in</span>
          </div>
        )}
        {state === 'failed' && (
          <div className="stack" role="alert">
            <h1 style={{ fontSize: '1.4rem' }}>This link has expired</h1>
            <p className="muted">Email links work once and expire after an hour. If you already confirmed your email, just sign in.</p>
            <Link className="btn" href="/login">Go to sign in</Link>
          </div>
        )}
      </div>
    </main>
  );
}
