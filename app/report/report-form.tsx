'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Bokamoso from '@/components/bokamoso';
import { reportChallenge, type ReportState } from './actions';

const PinPicker = dynamic(() => import('@/components/pin-picker'), { ssr: false, loading: () => <div className="pin-map sk" /> });

const EXAMPLES = [
  'High cost of solar electricity in Gaborone',
  'Our borehole breaks down and parts take weeks to arrive',
  'Vegetables rot before farmers can get them to market',
  'No recycling for plastic bottles in our village',
  'Young people in our ward cannot find work experience',
];
const SECTORS = ['Agriculture', 'Energy', 'Water', 'Health', 'Education', 'Manufacturing', 'Food processing', 'Tourism', 'Transport', 'Environment', 'Finance', 'Technology', 'Other'];

export default function ReportForm({ siteKey }: { siteKey: string | null }) {
  const [state, action, busy] = useActionState<ReportState, FormData>(reportChallenge, {});
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [title, setTitle] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const tsRef = useRef<HTMLDivElement>(null);

  // Load the invisible bot check only when it is configured
  useEffect(() => {
    if (!siteKey || document.getElementById('cf-ts')) return;
    const s = document.createElement('script');
    s.id = 'cf-ts';
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    document.head.appendChild(s);
  }, [siteKey]);

  if (state.code) {
    return (
      <div className="card stack" style={{ textAlign: 'center' }} role="status">
        <Bokamoso mode="yes" size={120} />
        <h2>Thank you. Your report is in.</h2>
        <p>Your tracking code is</p>
        <p className="track-code">{state.code}</p>
        <p className="muted">Keep it to check progress. A CEDA moderator reviews every report before it appears on the challenge map, usually within two working days.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="btn" href={`/report/track?code=${state.code}`}>Track this report</Link>
          <Link className="btn secondary" href="/challenges">See the challenge map</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="card stack">
      <div className="bk-auth"><Bokamoso mode={title ? 'watch' : 'wave'} look={Math.min(1, title.length / 40) * 2 - 1} size={76} />
        <p>Tell us about a problem you or your community face. Anything at all. Innovators may pick it up and solve it.</p></div>
      {state.error && <p className="notice bad" role="alert">{state.error}</p>}
      <div className="field">
        <label htmlFor="title">What is the problem?</label>
        <input id="title" name="title" required minLength={8} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="examples">
          <span className="muted">Not sure what to write? For example:</span>
          {EXAMPLES.map((x) => <button key={x} type="button" className="example" onClick={() => setTitle(x)}>{x}</button>)}
        </div>
      </div>
      <div className="field">
        <label htmlFor="description">Describe it</label>
        <span className="hint">Who does it affect, how often, and what have people tried?</span>
        <textarea id="description" name="description" required minLength={20} maxLength={1500} rows={4} />
      </div>
      <div className="field">
        <label htmlFor="sector">Area <span className="muted">(optional)</span></label>
        <select id="sector" name="sector" defaultValue=""><option value="">Choose one</option>{SECTORS.map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <div className="field">
        <label>Where is it?</label>
        <span className="hint">Tap the map near the place. It does not need to be exact.</span>
        <PinPicker lat={pin?.lat ?? null} lng={pin?.lng ?? null} onChange={(lat, lng) => setPin({ lat, lng })} />
        <input type="hidden" name="lat" value={pin?.lat ?? ''} />
        <input type="hidden" name="lng" value={pin?.lng ?? ''} />
      </div>
      <div className="field">
        <label htmlFor="photo">Photo <span className="muted">(optional)</span></label>
        <span className="hint">A photo of the problem, like a broken borehole or a dry field. Please avoid faces of people who have not agreed. Location and phone details are removed from the photo, and a moderator checks it before it is shown.</span>
        <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp"
          onChange={(e) => { const f = e.target.files?.[0]; setPreview(f ? URL.createObjectURL(f) : null); }} />
        {preview && <img src={preview} alt="Your photo" className="photo-preview" />}
      </div>
      {siteKey && <div ref={tsRef} className="cf-turnstile" data-sitekey={siteKey} data-size="flexible" />}
      <p className="muted" style={{ fontSize: '.85rem' }}>No account needed. We do not ask for your name. See the <a href="/help#privacy">privacy notice</a>.</p>
      <button className="btn" disabled={busy} aria-busy={busy}>{busy ? 'Sending...' : 'Send report'}</button>
    </form>
  );
}
