'use client';
import { useState } from 'react';
import { upvote } from '@/app/report/actions';

export default function Upvote({ id, n }: { id: string; n: number }) {
  const [count, setCount] = useState(n);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="upvote">
      <button type="button" className={`btn small ${done ? '' : 'secondary'}`} aria-pressed={done} disabled={done}
        onClick={async () => { const r = await upvote(id); if (r.error) setErr(r.error); else { setCount(r.n ?? count); setDone(true); } }}>
        {done ? 'Thanks' : 'This affects me too'} · {count}
      </button>
      {err && <small className="muted" role="alert">{err}</small>}
    </span>
  );
}
