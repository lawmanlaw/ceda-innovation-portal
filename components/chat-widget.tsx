'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import ChatPane from '@/components/chat-pane';
import Icon from '@/components/icon';

type Faq = { id: string; question: string; answer: string; topic: string };
type Thread = { id: string; status: string; agent_id: string | null; first_reply_at: string | null };
type View = 'home' | 'answer' | 'signin' | 'ask' | 'live' | 'rate';

// A consultant at a desk with a headset; talks and nods while consultants are online
function AgentArt({ live }: { live: boolean }) {
  return (
    <svg className={`agent-art ${live ? 'live' : ''}`} viewBox="0 0 120 96" aria-hidden="true">
      <rect x="14" y="82" width="92" height="4" rx="2" fill="var(--line)" />
      <g className="agent">
        <path d="M36 82c0-17 10-27 24-27s24 10 24 27z" fill="var(--brand)" />
        <circle cx="60" cy="38" r="14" fill="#8a5a44" />
        <path d="M46 37c0-10 6-16 14-16s14 6 14 16c-3-5-8-7-14-7s-11 2-14 7z" fill="#2a1d17" />
        <path d="M44 40a16 16 0 0 1 32 0" fill="none" stroke="var(--ink)" strokeWidth="3" />
        <rect x="41" y="37" width="6" height="10" rx="3" fill="var(--ink)" />
        <rect x="73" y="37" width="6" height="10" rx="3" fill="var(--ink)" />
        <path d="M44 46c0 6 5 9 11 9" fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="56" cy="55" r="2.5" fill="var(--accent)" />
      </g>
      <path d="M72 82l6-16h24l-6 16z" fill="var(--ink-3)" />
      <g className="waves" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round">
        <path d="M32 42a10 10 0 0 0 0 14" />
        <path d="M25 37a18 18 0 0 0 0 24" />
      </g>
      <circle className="dot" cx="98" cy="22" r="6" />
    </svg>
  );
}

const STEPS = ['In the queue', 'Accepted', 'Talking to you'];

export default function ChatWidget({ userId, hide }: { userId: string | null; hide: boolean }) {
  const sb = supabaseBrowser();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('home');
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [q, setQ] = useState('');
  const [faq, setFaq] = useState<Faq | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [avail, setAvail] = useState<{ open: boolean; online: number } | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [info, setInfo] = useState<{ position: number | null; agent: string | null }>({ position: null, agent: null });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Who is available, checked on load and every minute
  useEffect(() => {
    const check = async () => {
      const [o, n] = await Promise.all([sb.rpc('chat_is_open'), sb.rpc('agents_online')]);
      setAvail({ open: !!o.data, online: (n.data as number) ?? 0 });
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [sb]);

  // On first open: load help articles and resume any conversation still running
  useEffect(() => {
    if (!open || faqs.length) return;
    sb.from('faqs').select('id, question, answer, topic').eq('published', true).order('sort')
      .then(({ data }: { data: unknown }) => setFaqs((data as Faq[]) ?? []));
    if (userId) {
      sb.from('chat_threads').select('id, status, agent_id, first_reply_at').eq('user_id', userId).neq('status', 'closed')
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
        .then(({ data }: { data: unknown }) => { if (data) { setThread(data as Thread); setView('live'); } });
    }
  }, [open, faqs.length, sb, userId]);

  // Follow the conversation: accepted, first reply, ended
  useEffect(() => {
    if (!thread?.id) return;
    const ch = sb.channel('widget:' + thread.id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_threads', filter: `id=eq.${thread.id}` },
        (p: { new: unknown }) => setThread(p.new as Thread))
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, thread?.id]);

  // Queue position while waiting, and the consultant's name once accepted
  useEffect(() => {
    if (!thread?.id) return;
    const tick = () => sb.rpc('chat_status', { p_thread: thread.id })
      .then(({ data }: { data: unknown }) => data && setInfo(data as typeof info));
    tick();
    if (thread.status !== 'waiting') return;
    const t = setInterval(tick, 10_000);
    return () => clearInterval(t);
  }, [sb, thread?.id, thread?.status, thread?.agent_id]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return faqs.slice(0, 6);
    const words = s.split(/\s+/).filter((w) => w.length > 2);
    return faqs.filter((f) => {
      const text = (f.question + ' ' + f.answer + ' ' + f.topic).toLowerCase();
      return text.includes(s) || words.some((w) => text.includes(w));
    });
  }, [q, faqs]);

  if (hide || path.startsWith('/login') || path.startsWith('/app/agent') || path === '/app/chat') return null;

  const live = !!avail?.open && (avail?.online ?? 0) > 0;
  const statusLine = !avail ? 'Checking who is available'
    : !avail.open ? 'Offline now. Open 09:00 to 16:00, Monday to Friday'
    : avail.online > 0 ? `${avail.online} consultant${avail.online > 1 ? 's' : ''} online now`
    : 'All consultants are busy right now';

  const step = thread?.status === 'waiting' ? 0 : thread?.status === 'active' ? (thread.first_reply_at ? 2 : 1) : -1;
  const liveLine = thread?.status === 'missed'
    ? 'We are offline right now. Your message is saved and a consultant will reply on the next working day.'
    : step === 0 ? (info.position ? `You are number ${info.position} in the queue` : 'Joining the queue')
    : step === 1 ? `${info.agent ?? 'A consultant'} accepted your chat`
    : step === 2 ? `${info.agent ?? 'A consultant'} is talking to you now`
    : 'This chat has ended';

  const talk = () => { setErr(null); setView(userId ? 'ask' : 'signin'); };

  async function start(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const msg = String(new FormData(e.currentTarget).get('message') ?? '').trim();
    if (!msg) return setErr('Write a short message first.');
    setBusy(true);
    const { data, error } = await sb.rpc('open_chat', { p_topic: (faq?.question ?? q.trim()) || 'General enquiry', p_message: msg, p_idea: null });
    setBusy(false);
    if (error) return setErr('Could not start the chat. Please try again.');
    const t = data as Thread;
    setThread({ id: t.id, status: t.status, agent_id: null, first_reply_at: null });
    setView('live');
  }

  async function rate(n: number | null) {
    if (thread) await sb.rpc('close_chat', { p_thread: thread.id, p_rating: n });
    setThread(null);
    setInfo({ position: null, agent: null });
    setNote('Thanks for chatting with us.');
    setView('home');
  }

  return (
    <>
      {open && (
        <section className="chat-panel" role="dialog" aria-label="Help and live chat">
          <header className="chat-head">
            <AgentArt live={live} />
            <div>
              <strong>CEDA support</strong>
              <span className={`chat-status ${live ? 'on' : ''}`}>{statusLine}</span>
            </div>
            <button className="chat-x" onClick={() => setOpen(false)} aria-label="Close help">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </header>

          <div className="chat-body" key={view}>
            {view === 'home' && (
              <>
                <h2>How can we help today?</h2>
                {note && <p className="notice" role="status">{note}</p>}
                <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setNote(null); }} placeholder="Search, for example: password" aria-label="Search help" autoFocus />
                <ul className="chat-faqs">
                  {results.map((f) => (
                    <li key={f.id}>
                      <button onClick={() => { setFaq(f); setView('answer'); }}>
                        <span>{f.question}</span>
                        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                      </button>
                    </li>
                  ))}
                </ul>
                {q.trim().length >= 2 && !results.length && <p className="muted">No articles match that yet.</p>}
                {q.trim().length >= 2 && (
                  <button className="btn secondary chat-cta" onClick={talk}><Icon name="headset" still /> Talk to a consultant</button>
                )}
              </>
            )}

            {view === 'answer' && faq && (
              <>
                <button className="btn ghost small" onClick={() => setView('home')}>Back</button>
                <h2>{faq.question}</h2>
                <p>{faq.answer}</p>
                <p className="muted">Did this answer your question?</p>
                <div className="row">
                  <button className="btn" onClick={() => { setNote('Glad that helped.'); setQ(''); setView('home'); }}>Yes, thanks</button>
                  <button className="btn secondary" onClick={talk}>No, talk to someone</button>
                </div>
              </>
            )}

            {view === 'signin' && (
              <>
                <h2>Sign in to chat</h2>
                <p className="muted">We link the chat to your account, so the consultant can see your submissions and you can find the answer later.</p>
                <div className="row">
                  <Link className="btn" href="/login">Sign in</Link>
                  <Link className="btn secondary" href="/login?mode=signup">Create an account</Link>
                </div>
              </>
            )}

            {view === 'ask' && (
              <form className="stack" onSubmit={start}>
                <button type="button" className="btn ghost small" onClick={() => setView(faq ? 'answer' : 'home')}>Back</button>
                <h2>Tell us what you need</h2>
                {!avail?.open && <p className="notice">We are offline now. Leave your message and a consultant will reply on the next working day.</p>}
                <label htmlFor="cw-msg" className="hint">Include your idea reference if it is about a submission.</label>
                <textarea id="cw-msg" name="message" required maxLength={2000} defaultValue={faq ? '' : q} style={{ minHeight: 110 }} />
                {err && <p className="error">{err}</p>}
                <button className="btn" disabled={busy} aria-busy={busy}>Start chat</button>
              </form>
            )}

            {view === 'live' && thread && userId && (
              <>
                {thread.status !== 'missed' && thread.status !== 'closed' && (
                  <ol className="chat-steps" aria-label="Chat progress">
                    {STEPS.map((s, i) => <li key={s} className={i <= step ? 'done' : ''}>{s}</li>)}
                  </ol>
                )}
                <p className="chat-live-line" role="status">{liveLine}</p>
                {thread.status === 'closed'
                  ? <button className="btn" onClick={() => setView('rate')}>Rate this chat</button>
                  : <ChatPane threadId={thread.id} me={userId} closed={false} onClose={() => setView('rate')} />}
              </>
            )}

            {view === 'rate' && (
              <>
                <h2>How was this chat?</h2>
                <div className="row">
                  {[1, 2, 3, 4, 5].map((n) => <button key={n} className="btn secondary" onClick={() => rate(n)} aria-label={`${n} out of 5`}>{n}</button>)}
                  <button className="btn ghost" onClick={() => rate(null)}>Skip</button>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      <button className={`chat-fab ${open ? 'is-open' : ''}`} onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close help' : 'Help and live chat'} aria-expanded={open}>
        <Icon name={open ? 'plus' : 'headset'} still />
        {!open && <span className={`fab-dot ${live ? 'on' : ''}`} />}
      </button>
    </>
  );
}
