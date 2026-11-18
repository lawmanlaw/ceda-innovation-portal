'use client';
import { useOptimistic, useTransition } from 'react';
import { toggleMilestone } from '@/app/app/actions';

export type Milestone = { id: string; title: string; due_date: string | null; done_at: string | null };

export function Milestones({ ideaId, items, canTick }: { ideaId: string; items: Milestone[]; canTick: boolean }) {
  const [list, setList] = useOptimistic(items, (cur, p: { id: string; done: boolean }) => cur.map((m) => (m.id === p.id ? { ...m, done_at: p.done ? new Date().toISOString() : null } : m)));
  const [, start] = useTransition();
  const done = list.filter((m) => m.done_at).length;
  const pct = list.length ? Math.round((done / list.length) * 100) : 0;
  return (
    <div className="stack" style={{ gap: '.6rem' }}>
      <div className="ms-bar" aria-label={`${done} of ${list.length} steps done`}><i style={{ width: `${pct}%` }} /></div>
      <p className="muted" style={{ margin: 0 }}>{done} of {list.length} steps done ({pct}%)</p>
      <ul className="ms-list">
        {list.map((m) => {
          const late = !m.done_at && m.due_date && m.due_date < new Date().toISOString().slice(0, 10);
          return (
            <li key={m.id} className={m.done_at ? 'done' : ''}>
              <label className="row consent">
                <input type="checkbox" checked={Boolean(m.done_at)} disabled={!canTick}
                  onChange={(e) => { const v = e.target.checked; start(async () => { setList({ id: m.id, done: v }); await toggleMilestone(ideaId, m.id, v); }); }} />
                <span>{m.title}{m.due_date && <small className={late ? 'late' : 'muted'}> · {late ? 'overdue, was due' : 'due'} {new Date(m.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</small>}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
