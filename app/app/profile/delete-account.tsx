'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function DeleteAccount({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setErr(null);
    const sb = supabaseBrowser();
    // Files first, then the account and everything linked to it
    const { data: files } = await sb.from('attachments').select('storage_path, ideas!inner(owner_id)').eq('ideas.owner_id', userId);
    const paths = ((files ?? []) as { storage_path: string }[]).map((f) => f.storage_path);
    if (paths.length) await sb.storage.from('idea-files').remove(paths);
    const { error } = await sb.rpc('delete_my_account');
    if (error) {
      setBusy(false);
      return setErr(error.code === '42501' ? error.message : 'We could not delete your account. Please try again or ask through live chat.');
    }
    await sb.auth.signOut();
    window.location.replace('/?deleted=1');
  }

  return (
    <section className="card stack">
      <h2>Delete my account</h2>
      <p className="muted">This permanently removes your account, every idea you submitted, its files, feedback and chats. It cannot be undone.</p>
      {!open ? (
        <button className="btn danger" onClick={() => setOpen(true)} style={{ alignSelf: 'flex-start' }}>Delete my account</button>
      ) : (
        <>
          <label htmlFor="confirm-del">Type DELETE to confirm</label>
          <input id="confirm-del" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
          {err && <p className="error" role="alert">{err}</p>}
          <div className="row">
            <button className="btn" style={{ background: 'var(--bad)' }} disabled={text !== 'DELETE' || busy} aria-busy={busy} onClick={remove}>Permanently delete</button>
            <button className="btn ghost" onClick={() => { setOpen(false); setText(''); }}>Cancel</button>
          </div>
        </>
      )}
    </section>
  );
}
