'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

type Mode = 'signin' | 'code' | 'signup' | 'verify' | 'forgot' | 'reset';

const TITLES: Record<Mode, string> = {
  signin: 'Sign in',
  code: 'Sign in with a code',
  signup: 'Create your account',
  verify: 'Check your email',
  forgot: 'Reset your password',
  reset: 'Choose a new password',
};

export default function AuthForm({ initialMode, districts }: { initialMode: Mode; districts: string[] }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [verifyType, setVerifyType] = useState<'email' | 'recovery'>('email');

  const go = (m: Mode) => {
    setError(null);
    setInfo(null);
    setMode(m);
  };

  const done = () => {
    router.replace('/app');
    router.refresh();
  };

  // Same wording whether or not the account exists, so the form can't be used to find out who is registered
  const sentCode = 'If that email is registered, we have sent a 6 digit code to it. It expires in 10 minutes.';

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? '').trim();
    try {
      if (mode === 'signin') {
        const { error } = await sb.auth.signInWithPassword({ email: v('email'), password: String(f.get('password')) });
        if (error) throw new Error('Email or password is not right.');
        return done();
      }
      if (mode === 'code') {
        setEmail(v('email'));
        await sb.auth.signInWithOtp({ email: v('email'), options: { shouldCreateUser: false } });
        setVerifyType('email');
        setMode('verify');
        setInfo(sentCode);
        return;
      }
      if (mode === 'signup') {
        const password = String(f.get('password'));
        if (password.length < 10) throw new Error('Use at least 10 characters for your password.');
        if (password !== String(f.get('password2'))) throw new Error('The two passwords do not match.');
        if (!f.get('consent')) throw new Error('Please agree to the privacy notice to continue.');
        const { error } = await sb.auth.signUp({
          email: v('email'),
          password,
          options: { data: { full_name: v('full_name'), organisation: v('organisation'), district: v('district') } },
        });
        if (error) throw new Error(error.message.includes('rate') ? 'Too many attempts. Please wait a minute.' : 'We could not create the account. Check your details and try again.');
        setEmail(v('email'));
        setVerifyType('email');
        setMode('verify');
        setInfo('We have sent a 6 digit code to your email. Enter it below to confirm your address.');
        return;
      }
      if (mode === 'verify') {
        const { error } = await sb.auth.verifyOtp({ email, token: v('token'), type: verifyType });
        if (error) throw new Error('That code is wrong or has expired. Request a new one.');
        if (verifyType === 'recovery') return go('reset');
        return done();
      }
      if (mode === 'forgot') {
        setEmail(v('email'));
        await sb.auth.resetPasswordForEmail(v('email'));
        setVerifyType('recovery');
        setMode('verify');
        setInfo(sentCode);
        return;
      }
      if (mode === 'reset') {
        const password = String(f.get('password'));
        if (password.length < 10) throw new Error('Use at least 10 characters for your password.');
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw new Error('We could not change your password. Try again.');
        return done();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack" noValidate={false}>
      <h1 style={{ fontSize: '1.5rem' }}>{TITLES[mode]}</h1>
      {info && <p className="notice" role="status">{info}</p>}
      {error && <p className="notice bad" role="alert">{error}</p>}

      {mode === 'signup' && (
        <>
          <div className="field"><label htmlFor="full_name">Full name</label><input id="full_name" name="full_name" required maxLength={120} autoComplete="name" /></div>
          <div className="field"><label htmlFor="organisation">Company or organisation <span className="muted">(optional)</span></label><input id="organisation" name="organisation" maxLength={120} autoComplete="organization" /></div>
          <div className="field">
            <label htmlFor="district">District or town</label>
            <select id="district" name="district" required defaultValue="">
              <option value="" disabled>Choose one</option>
              {districts.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
        </>
      )}

      {['signin', 'code', 'signup', 'forgot'].includes(mode) && (
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" defaultValue={email} /></div>
      )}

      {['signin', 'signup', 'reset'].includes(mode) && (
        <div className="field">
          <label htmlFor="password">{mode === 'signin' ? 'Password' : 'New password'}</label>
          {mode !== 'signin' && <span className="hint">At least 10 characters.</span>}
          <input id="password" name="password" type="password" required minLength={mode === 'signin' ? 1 : 10} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
        </div>
      )}
      {mode === 'signup' && (
        <>
          <div className="field"><label htmlFor="password2">Repeat password</label><input id="password2" name="password2" type="password" required autoComplete="new-password" /></div>
          <label className="row" style={{ fontWeight: 400, alignItems: 'flex-start' }}>
            <input type="checkbox" name="consent" required style={{ marginTop: '.35rem' }} />
            <span>I agree to CEDA processing my details to evaluate my ideas, as set out in the <a href="/help#privacy" target="_blank">privacy notice</a>.</span>
          </label>
        </>
      )}

      {mode === 'verify' && (
        <div className="field">
          <label htmlFor="token">6 digit code</label>
          <input id="token" name="token" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" autoFocus />
        </div>
      )}

      <button className="btn" type="submit" aria-busy={busy} disabled={busy} style={{ width: '100%' }}>
        {{ signin: 'Sign in', code: 'Email me a code', signup: 'Create account', verify: 'Confirm', forgot: 'Email me a code', reset: 'Save password' }[mode]}
      </button>

      <div className="stack" style={{ fontSize: '.95rem' }}>
        {mode === 'signin' && (
          <>
            <div className="row between">
              <button type="button" className="btn ghost small" onClick={() => go('code')}>Use a code instead</button>
              <button type="button" className="btn ghost small" onClick={() => go('forgot')}>Forgot password?</button>
            </div>
            <p>New here? <button type="button" className="btn ghost small" onClick={() => go('signup')}>Create an account</button></p>
          </>
        )}
        {mode !== 'signin' && <button type="button" className="btn ghost small" onClick={() => go('signin')}>Back to sign in</button>}
      </div>
    </form>
  );
}
