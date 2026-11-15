import { requireMe, supabaseServer } from '@/lib/supabase/server';
import IdeaForm from '@/components/idea-form';
import { submitIdea } from '@/app/app/actions';
import type { FormField } from '@/lib/types';

export const metadata = { title: 'Submit an idea' };

export default async function NewIdea() {
  const me = await requireMe('submitter');
  const sb = await supabaseServer();
  const [{ data: fields }, { data: categories }, { data: districts }] = await Promise.all([
    sb.from('form_fields').select('*').eq('active', true).order('sort'),
    sb.from('categories').select('id, name').eq('active', true).order('name'),
    sb.from('districts').select('name').order('name'),
  ]);
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <h1>Submit an idea</h1>
      <p className="muted">Every question marked as required must be answered. Your answers are seen only by you and the CEDA panel assigned to evaluate it.</p>
      <IdeaForm
        action={submitIdea}
        fields={(fields ?? []) as FormField[]}
        categories={categories ?? []}
        districts={(districts ?? []).map((d) => d.name)}
        defaultDistrict={me.district}
      />
    </div>
  );
}
