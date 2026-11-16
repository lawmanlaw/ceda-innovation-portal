'use client';
import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { fmtDate } from '@/lib/util';

type Msg = { id: number; sender_id: string | null; body: string; system: boolean; created_at: string };

// One conversation, live. Used by both the innovator and the consultant.
export default function ChatPane({ threadId, me, closed, onClose }: { threadId: string; me: string; closed: boolean; onClose?: () => void }) {
  const sb = supabaseBrowser();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    sb.from('chat_messages').select('id, sender_id, body, system, created_at').eq('thread_id', threadId).order('id')
      .then(({ data }: { data: unknown }) => alive && setMsgs((data as Msg[]) ?? []));
    const ch = sb
      .channel(`chat:${threadId}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` }, (p: { new: unknown }) => {
        setMsgs((prev) => (prev.some((m) => m.id === (p.new as Msg).id) ? prev : [...prev, p.new as Msg]));
      })
      .subscribe();
    return () => {
      alive = false;
      sb.removeChannel(ch);
    };
  }, [sb, threadId]);

  // Braces matter: newer browsers return a promise from scrollIntoView, which React would treat as a cleanup
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText('');
    const { data, error } = await sb.from('chat_messages').insert({ thread_id: threadId, sender_id: me, body: body.slice(0, 2000) }).select('id, sender_id, body, system, created_at').single();
    if (error) {
      setErr('Message not sent. Please try again.');
      setText(body);
      return;
    }
    setErr(null);
    setMsgs((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as Msg]));
  }

  return (
    <div className="stack">
      <div className="stack chat-scroll" aria-live="polite">
        {msgs.map((m) => (
          <div key={m.id} className={`bubble ${m.system ? 'system' : m.sender_id === me ? 'mine' : ''}`}>
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
            {!m.system && <small style={{ opacity: .75 }}>{fmtDate(m.created_at, true)}</small>}
          </div>
        ))}
        <div ref={end} />
      </div>
      {closed ? <p className="muted">This conversation is closed.</p> : (
        <form onSubmit={send} className="row">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Type a message" aria-label="Message" style={{ flex: 1 }} />
          <button className="btn">Send</button>
          {onClose && <button type="button" className="btn ghost" onClick={onClose}>End chat</button>}
        </form>
      )}
      {err && <p className="error" role="alert">{err}</p>}
    </div>
  );
}
