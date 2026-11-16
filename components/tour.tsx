'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Bokamoso from '@/components/bokamoso';

// Bokamoso's first-visit tour of the innovator dashboard. Skippable at every step,
// remembered per browser, and replayable from the account menu (/app?tour=1).
const KEY = 'bokamoso-tour-v1';
const STEPS: { sel?: string; text: string }[] = [
  { text: "Hi, I'm Bokamoso and I love innovation 💡 Let's shape your idea together. Can I show you around? It takes under a minute." },
  { sel: 'main a[href="/app/ideas/new"], .dock a[href="/app/ideas/new"]', text: 'Start here. Your idea saves as a draft while you type, so you can leave and come back. Your drafts and submitted ideas show on this page with their stage.' },
  { sel: 'summary[aria-label^="Alerts"]', text: 'Alerts tell you when your idea moves to a new stage or the panel leaves feedback.' },
  { sel: '.chat-fab', text: 'Stuck? Search the help articles here, or talk to a CEDA consultant on working days.' },
  { sel: 'header a[href="/help"], .dock a[href="/help"]', text: 'The Help page has answers to common questions and contacts for regulators like CIPA and BURS.' },
  { text: "That's the tour. Before you submit, I'll go through a checklist with you. You can replay this from your account menu any time." },
];

const visible = (sel?: string) => (sel
  ? [...document.querySelectorAll<HTMLElement>(sel)].find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) ?? null
  : null);

export default function Tour({ path = '/app' }: { path?: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const replay = params.get('tour') === '1';
  const [step, setStep] = useState(-1);
  const [box, setBox] = useState<DOMRect | null>(null);
  const next = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (pathname !== path) return;
    let seen = false;
    try { seen = localStorage.getItem(KEY) === '1'; } catch { /* storage blocked: show the tour */ }
    if (replay || !seen) setStep(0);
  }, [pathname, path, replay]);

  const end = useCallback(() => {
    try { localStorage.setItem(KEY, '1'); } catch { /* fine */ }
    setStep(-1);
    if (replay) router.replace(path, { scroll: false });
  }, [replay, router, path]);

  useEffect(() => {
    if (step < 0) return;
    const s = STEPS[step];
    const el = visible(s.sel);
    if (s.sel && !el) { setStep(step + 1 < STEPS.length ? step + 1 : -1); return; }
    if (el) { el.scrollIntoView({ block: 'center' }); }
    const place = () => { setBox(el ? el.getBoundingClientRect() : null); };
    place();
    next.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') end(); };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [step, end]);

  if (step < 0) return null;
  const last = step === STEPS.length - 1;
  const below = box ? box.bottom + 240 < window.innerHeight : false;
  const pos: React.CSSProperties = box
    ? { left: Math.max(12, Math.min(box.left, window.innerWidth - 352)), ...(below ? { top: box.bottom + 14 } : { bottom: window.innerHeight - box.top + 14 }) }
    : {};
  const look = box ? (box.left + box.width / 2 > window.innerWidth / 2 ? 1 : -1) : 0;

  return (
    <div className={`tour${box ? '' : ' dim'}`} role="dialog" aria-modal="true" aria-label="Portal tour with Bokamoso">
      {box && <div className="tour-spot" style={{ transform: `translate(${box.left - 6}px, ${box.top - 6}px)`, width: box.width + 12, height: box.height + 12 }} />}
      <div className={`tour-card${box ? '' : ' center'}`} style={pos} key={step}>
        <Bokamoso mode={step === 0 ? 'wave' : last ? 'yes' : 'watch'} look={look} size={84} />
        <div>
          <p aria-live="polite">{STEPS[step].text}</p>
          <div className="row between">
            {last ? <span /> : <button type="button" className="btn ghost small" onClick={end}>Skip tour</button>}
            <button ref={next} type="button" className="btn small" onClick={() => (last ? end() : setStep(step + 1))}>
              {step === 0 ? 'Show me around' : last ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
