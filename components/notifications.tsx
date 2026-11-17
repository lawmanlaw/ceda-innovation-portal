'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { fmtDate } from '@/lib/util';

type N = { id: number; idea_id: string | null; title: string; body: string | null; read_at: string | null; created_at: string };

// Live alerts: new rows arrive over Supabase Realtime, and the page refreshes so stages update without reloading
export default function Notifications({ userId }: { userId: string }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [items, setItems] = useState<N[]>([]);

  useEffect(() => {
    let alive = true;
    sb.from('notifications').select('id, idea_id, title, body, read_at, created_at').order('created_at', { ascending: false }).limit(20)
      .then(({ data }: { data: unknown }) => alive && setItems((data as N[]) ?? []));
    const ch = sb
      .channel(`notifications:${userId}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (p: { new: unknown }) => {
        setItems((prev) => [p.new as N, ...prev].slice(0, 20));
        router.refresh();
      })
      .subscribe();
    return () => {
      alive = false;
      sb.removeChannel(ch);
    };
  }, [sb, userId, router]);

  const unread = items.filter((i) => !i.read_at).length;

  async function markAll() {
    const ids = items.filter((i) => !i.read_at).map((i) => i.id);
    if (!ids.length) return;
    await sb.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
    setItems((prev) => prev.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })));
  }

  return (
    <details name="topmenu" style={{ position: 'relative' }} onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && markAll()}>
      <summary className="btn ghost small" style={{ listStyle: 'none' }} aria-label={`Alerts, ${unread} unread`}>
        Alerts{unread > 0 && <strong style={{ color: 'var(--brand)' }}> {unread}</strong>}
      </summary>
      <div className="card" style={{ position: 'absolute', right: 0, top: '110%', width: 320, maxHeight: 420, overflow: 'auto', zIndex: 30 }}>
        {items.length === 0 && <p className="muted">No alerts yet. We will tell you here when anything changes.</p>}
        {items.map((n) => (
          <div key={n.id} style={{ padding: '.5rem 0', borderTop: '1px solid var(--line)' }}>
            {n.idea_id ? <Link href={`/app/ideas/${n.idea_id}`}><strong>{n.title}</strong></Link> : <strong>{n.title}</strong>}
            {n.body && <div className="muted" style={{ fontSize: '.9rem' }}>{n.body}</div>}
            <small>{fmtDate(n.created_at, true)}</small>
          </div>
        ))}
      </div>
    </details>
  );
}
