'use client';
import { useActionState, useEffect, useRef } from 'react';
import type { ActionState } from '@/app/app/actions';

// Wraps any server action with pending state and inline success/error messages
export default function ActionForm({
  action,
  children,
  submit,
  extra,
  reset = false,
  className = 'stack',
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submit: string;
  extra?: React.ReactNode;
  reset?: boolean;
  className?: string;
}) {
  const [state, run, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (reset && state.ok) ref.current?.reset();
  }, [state, reset]);
  return (
    <form ref={ref} action={run} className={className}>
      {children}
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.ok && <p role="status" style={{ color: 'var(--ok)' }}>{state.ok}</p>}
      <div className="row">
        <button className="btn" disabled={pending} aria-busy={pending}>{submit}</button>
        {extra}
      </div>
    </form>
  );
}
