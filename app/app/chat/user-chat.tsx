'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import ChatPane from '@/components/chat-pane';
import { fmtDate } from '@/lib/util';

type Thread = { id: string; topic: string | null; status: string; created_at: string };

export default function UserChat({ me, threads, ideas }: { me: string; threads: Thread[]; ideas: { id: string; ref: string; title: string }[] }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const current = threads.find((t) => t.status !== 'closed');
  const [active, setActive] = useState<string | null>(current?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rating, setRating] = useState<string | null>(null);

  async function start(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { data, error } = await sb.rpc('open_chat', {
      p_topic: String(f.get('topic') || 'General enquiry'),
      p_message: String(f.get('message')),
      p_idea: (f.get('idea') as string) || null,
    });
    setBusy(false);
    if (error) return setErr('Could not start the chat. Please try again.');
    setActive((data as Thread).id);
    router.refresh();
  }

  async function close() {
    if (!active) return;
    setRating(active);
  }

  async function rate(n: number | null) {
    if (!rating) return;
    await sb.rpc('close_chat', { p_thread: rating, p_rating: n });
    setRating(null);
    setActive(null);
    router.refresh();
  }

  if (rating) {
    return (
      <div className="card stack">
        <h2>How was this chat?</h2>
        <div className="row">
          {[1, 2, 3, 4, 5].map((n) => <button key={n} className="btn secondary" onClick={() => rate(n)} aria-label={`${n} out of 5`}>{n}</button>)}
          <button className="btn ghost" onClick={() => rate(null)}>Skip</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {active ? (
        <div className="card"><ChatPane threadId={active} me={me} closed={false} onClose={close} /></div>
      ) : (
        <form className="card stack" onSubmit={start}>
          <div className="field"><label htmlFor="topic">What is it about?</label><input id="topic" name="topic" maxLength={120} placeholder="For example: help with my submission" /></div>
          {ideas.length > 0 && (
            <div className="field">
              <label htmlFor="idea">Related idea <span className="muted">(optional)</span></label>
              <select id="idea" name="idea" defaultValue="">
                <option value="">None</option>
                {ideas.map((i) => <option key={i.id} value={i.id}>{i.ref}: {i.title}</option>)}
              </select>
            </div>
          )}
          <div className="field"><label htmlFor="message">Your message</label><textarea id="message" name="message" required maxLength={2000} style={{ minHeight: 90 }} /></div>
          {err && <p className="error">{err}</p>}
          <button className="btn" disabled={busy} aria-busy={busy}>Start chat</button>
        </form>
      )}

      {threads.filter((t) => t.status === 'closed').length > 0 && (
        <section className="card">
          <h2>Past conversations</h2>
          <ul style={{ paddingLeft: '1.1rem' }}>
            {threads.filter((t) => t.status === 'closed').map((t) => <li key={t.id}>{t.topic ?? 'Enquiry'} <small>{fmtDate(t.created_at, true)}</small></li>)}
          </ul>
        </section>
      )}
    </>
  );
}
