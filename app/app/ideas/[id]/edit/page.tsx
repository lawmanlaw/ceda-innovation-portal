import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireMe, supabaseServer } from '@/lib/supabase/server';
import IdeaForm from '@/components/idea-form';
import { resubmitIdea } from '@/app/app/actions';
import type { FormField, Idea } from '@/lib/types';

export const metadata = { title: 'Edit and resubmit' };

export default async function EditIdea({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const me = await requireMe('submitter');
  const sb = await supabaseServer();
  const { data } = await sb.from('ideas').select('*').eq('id', id).eq('owner_id', me.id).maybeSingle();
  if (!data) notFound();
  const idea = data as Idea;
  if (idea.stage !== 'feedback') redirect(`/app/ideas/${id}`);
  const [{ data: fields }, { data: categories }, { data: districts }, { data: fb }] = await Promise.all([
    sb.from('form_fields').select('*').eq('active', true).order('sort'),
    sb.from('categories').select('id, name').eq('active', true).order('name'),
    sb.from('districts').select('name').order('name'),
    sb.from('feedback').select('body, created_at').eq('idea_id', id).neq('author_id', me.id).order('created_at', { ascending: false }).limit(1),
  ]);
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <p><Link href={`/app/ideas/${id}`}>Back to {idea.ref}</Link></p>
      <h1>Edit and resubmit</h1>
      {fb?.[0] && (
        <div className="notice">
          <strong>Latest feedback</strong>
          <p style={{ whiteSpace: 'pre-wrap', margin: '.25rem 0 0' }}>{fb[0].body}</p>
        </div>
      )}
      <IdeaForm action={resubmitIdea} idea={idea} fields={(fields ?? []) as FormField[]} categories={categories ?? []} districts={(districts ?? []).map((d) => d.name)} />
    </div>
  );
}
