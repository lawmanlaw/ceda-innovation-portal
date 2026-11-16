'use client';
import { useEffect, useState } from 'react';
import Bokamoso, { type BkMode } from '@/components/bokamoso';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { emailLinkClient } from '@/lib/supabase/email-links';
import Icon from '@/components/icon';

type Mode = 'signin' | 'code' | 'signup' | 'verify' | 'forgot' | 'reset';

const TITLES: Record<Mode, string> = {
  signin: 'Sign in',
  code: 'Sign in with an email link',
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
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [verifyType, setVerifyType] = useState<'email' | 'recovery'>('email');

  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pw2Touched, setPw2Touched] = useState(false);
  const mismatch = mode === 'signup' && pw2.length > 0 && (pw2Touched || pw2.length >= pw.length) && pw !== pw2;

  // Bokamoso watches text being typed, covers his eyes on password boxes and reacts to errors
  const [focus, setFocus] = useState('');
  const [look, setLook] = useState(0);
  const isPw = focus.startsWith('password');
  const bk: BkMode = mismatch ? 'peek' : isPw ? 'hide' : error ? 'no' : focus ? 'watch' : 'idle';
  const say = mismatch ? 'Those two passwords do not match yet.' : isPw ? "I'm not looking. Type away."
    : error ? 'Hmm, that did not work. Have another go.'
    : mode === 'signup' ? "Hi, I'm Bokamoso. Let's get you set up." : mode === 'signin' ? "Hi, I'm Bokamoso. Welcome back." : "I'll help you get back in.";
  const track = (t: EventTarget) => {
    const el = t as HTMLInputElement;
    if (el.tagName === 'INPUT' && el.type !== 'password' && el.type !== 'checkbox') setLook(Math.min(1, el.value.length / 26) * 2 - 1);
  };
  useEffect(() => { if (error) (document.activeElement as HTMLElement | null)?.blur(); }, [error]);

  const go = (m: Mode) => {
    setError(null);
    setInfo(null);
    setMode(m);
  };

  // Show the tick briefly, then move on
  const done = () => {
    setSuccess(true);
    setTimeout(() => {
      router.replace('/app');
      router.refresh();
    }, 700);
  };

  // Same wording whether or not the account exists, so the form can't be used to find out who is registered
  const sentCode = 'If that email is registered, we have sent a 6 digit code to it. It expires in 10 minutes.';
  const sentLink = 'If that email is registered, we have sent you a sign-in link. Tap it on any device to sign in. It expires in 1 hour.';

  async function oauth(provider: 'google') {
    setError(null);
    setBusy(true);
    const { error } = await sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setBusy(false);
      setError('That sign-in option is not available right now. Use your email instead.');
    }
  }

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
        await emailLinkClient().auth.signInWithOtp({ email: v('email'), options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/confirm` } });
        setInfo(sentLink);
        return;
      }
      if (mode === 'signup') {
        const password = String(f.get('password'));
        if (password.length < 10) throw new Error('Use at least 10 characters for your password.');
        if (password !== String(f.get('password2'))) {
          setPw2Touched(true);
          document.getElementById('password2')?.focus();
          return;
        }
        if (!f.get('consent')) throw new Error('Please agree to the privacy notice to continue.');
        const { error } = await emailLinkClient().auth.signUp({
          email: v('email'),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm`,
            data: { full_name: v('full_name'), organisation: v('organisation'), district: v('district') },
          },
        });
        if (error) throw new Error(error.message.includes('rate') ? 'Too many attempts. Please wait a minute.' : 'We could not create the account. Check your details and try again.');
        setEmail(v('email'));
        setInfo('Almost done. If this is a new account, we have sent you an email. Tap the link in it on any device and you will be signed in straight away. If you already have an account, no email is sent, so sign in instead.');
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
        await emailLinkClient().auth.resetPasswordForEmail(v('email'), { redirectTo: `${window.location.origin}/auth/confirm` });
        setInfo(sentLink);
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

  if (success) {
    return (
      <div className="success" role="status">
        <Bokamoso mode="yes" size={120} />
        <Icon name="check" className="tick" />
        <strong>You are signed in</strong>
        <span className="muted">Taking you to your dashboard</span>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`stack${mode === 'signup' ? ' signup' : ''}`} noValidate={false}
      onFocusCapture={(e) => { const t = e.target as HTMLElement; setFocus(['INPUT', 'SELECT'].includes(t.tagName) ? t.id : ''); track(t); }}
      onBlurCapture={() => setFocus('')} onInputCapture={(e) => track(e.target)}>
      <h1 style={{ fontSize: '1.5rem' }}>{TITLES[mode]}</h1>
      <div className="bk-auth"><Bokamoso mode={bk} look={look} size={76} /><p aria-live="polite">{say}</p></div>
      {info && <p className="notice" role="status">{info}</p>}
      {(mode === 'signin' || mode === 'signup') && (
        <>
          <button type="button" className="btn secondary" style={{ width: '100%' }} onClick={() => oauth('google')} disabled={busy}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.8 6C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.8c-.5-1.5-.8-3.1-.8-4.8s.3-3.3.8-4.8l-7.8-6C1 16.5 0 20.1 0 24s1 7.5 2.7 10.8l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.7l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>
            Continue with Google
          </button>
          <p className="muted" style={{ fontSize: '.85rem', margin: 0 }}>By continuing with Google you agree to the <a href="/help#privacy" target="_blank">privacy notice</a>.</p>
          <p className="or-line"><span>or use your email</span></p>
        </>
      )}
      {error && <p className="notice bad" role="alert">{error}</p>}

      {mode === 'signup' && (
        <div className="grid cols-2 tight">
          <div className="field"><label htmlFor="full_name">Full name</label><input id="full_name" name="full_name" required maxLength={120} autoComplete="name" /></div>
          <div className="field">
            <label htmlFor="district">District or town</label>
            <select id="district" name="district" required defaultValue="">
              <option value="" disabled>Choose one</option>
              {districts.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" defaultValue={email} /></div>
          <div className="field"><label htmlFor="organisation">Organisation <span className="muted">(optional)</span></label><input id="organisation" name="organisation" maxLength={120} autoComplete="organization" /></div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" aria-describedby="pw-hint"
              value={pw} onChange={(e) => setPw(e.target.value)} />
            <span id="pw-hint" className={`field-note${pw.length >= 10 ? ' ok' : ''}`}>
              {pw.length >= 10 ? 'Long enough' : pw.length ? `${10 - pw.length} more ${10 - pw.length === 1 ? 'character' : 'characters'}` : 'At least 10 characters'}
            </span>
          </div>
          <div className="field">
            <label htmlFor="password2">Repeat password</label>
            <input id="password2" name="password2" type="password" required autoComplete="new-password" aria-describedby="pw2-hint" aria-invalid={mismatch}
              value={pw2} onChange={(e) => setPw2(e.target.value)} onBlur={() => setPw2Touched(true)} />
            <span id="pw2-hint" className={`field-note${mismatch ? ' bad' : pw2 && pw === pw2 ? ' ok' : ''}`} role={mismatch ? 'alert' : undefined}>
              {mismatch ? 'Passwords do not match' : pw2 && pw === pw2 ? 'Passwords match' : '\u00a0'}
            </span>
          </div>
        </div>
      )}

      {['signin', 'code', 'forgot'].includes(mode) && (
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" defaultValue={email} /></div>
      )}

      {['signin', 'reset'].includes(mode) && (
        <div className="field">
          <label htmlFor="password">{mode === 'signin' ? 'Password' : 'New password'}</label>
          {mode !== 'signin' && <span className="hint">At least 10 characters.</span>}
          <input id="password" name="password" type="password" required minLength={mode === 'signin' ? 1 : 10} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
        </div>
      )}
      {mode === 'signup' && (
        <label className="row consent">
          <input type="checkbox" name="consent" required />
          <span>I agree to CEDA processing my details to evaluate my ideas, as set out in the <a href="/help#privacy" target="_blank">privacy notice</a>.</span>
        </label>
      )}

      {mode === 'verify' && (
        <div className="field">
          <label htmlFor="token">6 digit code</label>
          <input id="token" name="token" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" autoFocus />
        </div>
      )}

      <button className="btn" type="submit" aria-busy={busy} disabled={busy} style={{ width: '100%' }}>
        {{ signin: 'Sign in', code: 'Email me a sign-in link', signup: 'Create account', verify: 'Confirm', forgot: 'Email me a reset link', reset: 'Save password' }[mode]}
      </button>

      <div className="stack" style={{ fontSize: '.95rem' }}>
        {mode === 'signin' && (
          <>
            <div className="row between">
              <button type="button" className="btn ghost small" onClick={() => go('code')}>Email me a link instead</button>
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
