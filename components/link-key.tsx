'use client';
import { useActionState } from 'react';
import { linkServerKey } from '@/app/app/actions';

export default function LinkKey({ linked }: { linked: boolean }) {
  const [state, run, busy] = useActionState(async () => linkServerKey(), {} as { ok?: string; error?: string });
  return (
    <form action={run} className="notice row between">
      <span>{state.ok ?? state.error ?? (linked ? 'Community reports and upvotes are connected.' : 'Community reports and upvotes are not connected yet.')}</span>
      <button className="btn small" disabled={busy} aria-busy={busy}>{linked || state.ok ? 'Re-link key' : 'Connect community features'}</button>
    </form>
  );
}
