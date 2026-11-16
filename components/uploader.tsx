'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { recordAttachment } from '@/app/app/actions';

// Quick check for a friendly message; the real check runs on the server after upload
const TYPES: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export default function Uploader({ ideaId }: { ideaId: string }) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const type = TYPES[file.name.toLowerCase().split('.').pop() ?? ''];
    if (!type) return (setBlocked(true), setMsg('Use PDF, Word (.docx), PowerPoint, Excel or an image. Older .doc files are not accepted.'));
    if (file.size > 10 * 1024 * 1024) return (setBlocked(true), setMsg('Files can be up to 10 MB.'));
    setBlocked(false);
    setBusy(true);
    setMsg('Uploading and checking for viruses and hidden code...');
    const safe = file.name.replace(/[^\w.\- ]+/g, '').slice(-80) || 'file';
    const path = `${ideaId}/${crypto.randomUUID()}-${safe}`;
    const { error } = await sb.storage.from('idea-files').upload(path, file, { contentType: type, upsert: false });
    if (error) {
      setBusy(false);
      return setMsg('Upload failed. Please try again.');
    }
    const res = await recordAttachment(ideaId, path, file.name);
    setBusy(false);
    setBlocked(Boolean(res.error));
    setMsg(res.error ?? `${file.name} passed the safety check.`);
    router.refresh();
  }

  return (
    <div>
      <label className="btn secondary small" style={{ display: 'inline-flex' }} aria-busy={busy}>
        Add a file
        <input type="file" onChange={onChange} disabled={busy} accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.pptx,.xlsx" style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} />
      </label>
      <span className="muted" style={{ marginLeft: '.75rem' }}>PDF, Word, PowerPoint, Excel or images, up to 10 MB each. Every file is checked for viruses and hidden code.</span>
      {msg && <p className={blocked ? 'notice bad' : 'muted'} role={blocked ? 'alert' : 'status'}>{msg}</p>}
    </div>
  );
}
