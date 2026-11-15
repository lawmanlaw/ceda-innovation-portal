'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import ChatPane from '@/components/chat-pane';
import { fmtDate } from '@/lib/util';

type Thread = { id: string; user_id: string; agent_id: string | null; topic: string | null; status: string; created_at: string; opened_outside_hours: boolean; profiles: { full_name: string } | null };

export default function AgentConsole({ me }: { me: string }) {
  const sb = supabaseBrowser();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await sb
      .from('chat_threads')
      .select('id, user_id, agent_id, topic, status, created_at, opened_outside_hours, profiles!chat_threads_user_id_fkey(full_name)')
      .neq('status', 'closed')
      .order('created_at');
    setThreads((data as unknown as Thread[]) ?? []);
  }, [sb]);

  useEffect(() => {
    load();
    sb.rpc('agent_heartbeat');
    const beat = setInterval(() => sb.rpc('agent_heartbeat'), 60_000);
    const ch = sb.channel('agent-threads').on('postgres_changes', { event: '*', schema: 'public', table: 'chat_threads' }, load).subscribe();
    return () => {
      clearInterval(beat);
      sb.removeChannel(ch);
    };
  }, [sb, load]);

  async function claim(id: string) {
    setErr(null);
    const { error } = await sb.rpc('claim_chat', { p_thread: id });
    if (error) return setErr('Another consultant already took that chat.');
    setActive(id);
    load();
  }

  async function close(id: string) {
    await sb.rpc('close_chat', { p_thread: id, p_rating: null });
    setActive(null);
    load();
  }

  const waiting = threads.filter((t) => !t.agent_id);
  const mine = threads.filter((t) => t.agent_id === me);
  const current = threads.find((t) => t.id === active);

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(240px, 1fr) minmax(0, 2fr)', alignItems: 'start' }}>
      <div className="stack">
        <section className="card">
          <h2>Waiting <span className="muted">({waiting.length})</span></h2>
          {!waiting.length && <p className="muted">Nobody is waiting.</p>}
          {waiting.map((t) => (
            <div key={t.id} className="row between" style={{ padding: '.4rem 0' }}>
              <span>{t.profiles?.full_name || 'Visitor'}<br /><small>{t.topic} · {fmtDate(t.created_at, true)}{t.opened_outside_hours ? ' · after hours' : ''}</small></span>
              <button className="btn small" onClick={() => claim(t.id)}>Take</button>
            </div>
          ))}
          {err && <p className="error">{err}</p>}
        </section>
        <section className="card">
          <h2>My chats <span className="muted">({mine.length})</span></h2>
          {!mine.length && <p className="muted">None open.</p>}
          {mine.map((t) => (
            <button key={t.id} className={`btn ${t.id === active ? '' : 'ghost'}`} style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setActive(t.id)}>
              {t.profiles?.full_name || 'Visitor'}: {t.topic}
            </button>
          ))}
        </section>
      </div>
      <section className="card">
        {current ? (
          <>
            <h2>{current.profiles?.full_name || 'Visitor'}</h2>
            <p className="muted">{current.topic}</p>
            <ChatPane key={current.id} threadId={current.id} me={me} closed={false} onClose={() => close(current.id)} />
          </>
        ) : <p className="muted">Pick a chat on the left.</p>}
      </section>
    </div>
  );
}
