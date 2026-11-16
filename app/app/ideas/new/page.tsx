import Link from 'next/link';
import { requireMe, supabaseServer } from '@/lib/supabase/server';
import DraftForm from '@/components/draft-form';
import type { FormField, Idea } from '@/lib/types';

export const metadata = { title: 'Submit an idea' };

export default async function NewIdea({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const me = await requireMe('submitter');
  const { draft: draftId } = await searchParams;
  const sb = await supabaseServer();
  const valid = draftId && /^[0-9a-f-]{36}$/.test(draftId);
  const [{ data: fields }, { data: categories }, { data: districts }, { data: draft }, { data: files }] = await Promise.all([
    sb.from('form_fields').select('*').eq('active', true).order('sort'),
    sb.from('categories').select('id, name').eq('active', true).order('name'),
    sb.from('districts').select('name').order('name'),
    valid ? sb.from('ideas').select('*').eq('id', draftId).eq('owner_id', me.id).eq('stage', 'draft').maybeSingle() : Promise.resolve({ data: null }),
    valid ? sb.from('attachments').select('id, file_name, storage_path, size_bytes').eq('idea_id', draftId).order('created_at') : Promise.resolve({ data: [] }),
  ]);
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <p><Link href="/app">Back to my ideas</Link></p>
      <h1>{draft ? 'Continue your draft' : 'Submit an idea'}</h1>
      <p className="muted">Take your time: your work is saved as a draft while you type, and you can come back to it later. Only you can see a draft. Your answers are seen by the CEDA panel only after you submit.</p>
      <DraftForm
        key={draft?.id ?? 'new'}
        fields={(fields ?? []) as FormField[]}
        categories={categories ?? []}
        districts={(districts ?? []).map((d) => d.name)}
        draft={(draft as Idea) ?? null}
        files={files ?? []}
        defaultDistrict={me.district}
      />
    </div>
  );
}
