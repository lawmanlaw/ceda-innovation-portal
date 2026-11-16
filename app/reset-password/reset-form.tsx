'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function ResetForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get('password'));
    if (password.length < 10) return setError('Use at least 10 characters.');
    if (password !== String(f.get('password2'))) return setError('The two passwords do not match.');
    setBusy(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password });
    setBusy(false);
    if (error) return setError('We could not change your password. Request a new reset link and try again.');
    router.replace('/app');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="stack">
      {error && <p className="notice bad" role="alert">{error}</p>}
      <div className="field"><label htmlFor="password">New password</label><span className="hint">At least 10 characters.</span><input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" /></div>
      <div className="field"><label htmlFor="password2">Repeat password</label><input id="password2" name="password2" type="password" required autoComplete="new-password" /></div>
      <button className="btn" disabled={busy} aria-busy={busy}>Save password</button>
    </form>
  );
}
