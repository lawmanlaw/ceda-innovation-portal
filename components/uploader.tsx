'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { recordAttachment } from '@/app/app/actions';

const ALLOWED = ['application/pdf', 'image/png', 'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

export default function Uploader({ ideaId }: { ideaId: string }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED.includes(file.type)) return setMsg('Use PDF, Word, PowerPoint, Excel, PNG or JPG.');
    if (file.size > 10 * 1024 * 1024) return setMsg('Files can be up to 10 MB.');
    setBusy(true);
    setMsg('Uploading...');
    const safe = file.name.replace(/[^\w.\- ]+/g, '').slice(-80) || 'file';
    const path = `${ideaId}/${crypto.randomUUID()}-${safe}`;
    const { error } = await sb.storage.from('idea-files').upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      setBusy(false);
      return setMsg('Upload failed. Please try again.');
    }
    const res = await recordAttachment(ideaId, path, file.name, file.size);
    setBusy(false);
    setMsg(res.error ?? null);
    router.refresh();
  }

  return (
    <div>
      <label className="btn secondary small" style={{ display: 'inline-flex' }} aria-busy={busy}>
        Add a file
        <input type="file" onChange={onChange} disabled={busy} accept=".pdf,.png,.jpg,.jpeg,.docx,.pptx,.xlsx" style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} />
      </label>
      <span className="muted" style={{ marginLeft: '.75rem' }}>PDF, Office or images, up to 10 MB each</span>
      {msg && <p className="muted" role="status">{msg}</p>}
    </div>
  );
}
