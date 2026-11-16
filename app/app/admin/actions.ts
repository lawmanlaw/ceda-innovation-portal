'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireMe, supabaseServer } from '@/lib/supabase/server';
import { friendlyError } from '@/lib/util';
import type { ActionState } from '@/app/app/actions';

// Every admin write is also guarded by row level security; these checks just give clearer messages
async function admin() {
  await requireMe('admin');
  return supabaseServer();
}

const done = (tab: string, ok = 'Saved.'): ActionState => {
  revalidatePath('/app/admin');
  revalidatePath('/help');
  return { ok };
};

const str = (max: number) => z.string().trim().max(max);
const optUrl = z.string().trim().max(300).refine((v) => v === '' || /^https:\/\//.test(v), 'Links must start with https://');

export async function setRole(_: ActionState, f: FormData): Promise<ActionState> {
  const sb = await admin();
  const p = z.object({ id: z.string().uuid(), role: z.enum(['submitter', 'evaluator', 'adjudicator', 'admin', 'agent', 'observer']) })
    .safeParse({ id: f.get('id'), role: f.get('role') });
  if (!p.success) return { error: 'Choose a role.' };
  const { error } = await sb.from('profiles').update({ role: p.data.role }).eq('id', p.data.id);
  if (error) return { error: friendlyError(error) };
  return done('users', 'Role updated.');
}

export async function saveCriterion(_: ActionState, f: FormData): Promise<ActionState> {
  const sb = await admin();
  const p = z.object({
    id: z.string().uuid().optional(),
    name: str(120).min(2, 'Give the criterion a name.'),
    description: str(500),
    weight: z.coerce.number().positive('Weight must be above 0.').max(100),
    max_score: z.coerce.number().int().min(1).max(100),
    sort: z.coerce.number().int().min(0).max(1000),
    active: z.boolean(),
  }).safeParse({
    id: f.get('id') || undefined, name: f.get('name'), description: f.get('description') ?? '',
    weight: f.get('weight'), max_score: f.get('max_score'), sort: f.get('sort') || 0, active: f.get('active') === 'on',
  });
  if (!p.success) return { error: p.error.issues[0].message };
  const { id, ...row } = p.data;
  const { error } = id ? await sb.from('criteria').update(row).eq('id', id) : await sb.from('criteria').insert(row);
  if (error) return { error: friendlyError(error) };
  return done('criteria');
}

export async function saveField(_: ActionState, f: FormData): Promise<ActionState> {
  const sb = await admin();
  const p = z.object({
    id: z.string().uuid().optional(),
    key: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/, 'Use lowercase letters, numbers and underscores for the key.'),
    label: str(200).min(2, 'Add the question.'),
    help: str(400),
    kind: z.enum(['text', 'textarea', 'select', 'number', 'url']),
    options: str(2000),
    required: z.boolean(),
    max_length: z.coerce.number().int().min(10).max(10000),
    sort: z.coerce.number().int().min(0).max(1000),
    active: z.boolean(),
  }).safeParse({
    id: f.get('id') || undefined, key: f.get('key'), label: f.get('label'), help: f.get('help') ?? '', kind: f.get('kind'),
    options: f.get('options') ?? '', required: f.get('required') === 'on', max_length: f.get('max_length') || 2000,
    sort: f.get('sort') || 0, active: f.get('active') === 'on',
  });
  if (!p.success) return { error: p.error.issues[0].message };
  const { id, options, ...rest } = p.data;
  const opts = rest.kind === 'select' ? options.split('\n').map((o) => o.trim()).filter(Boolean).slice(0, 30) : null;
  if (rest.kind === 'select' && !opts?.length) return { error: 'Add at least one option, one per line.' };
  const row = { ...rest, help: rest.help || null, options: opts, updated_at: new Date().toISOString() };
  const { error } = id ? await sb.from('form_fields').update(row).eq('id', id) : await sb.from('form_fields').insert(row);
  if (error) return { error: error.code === '23505' ? 'That key is already used.' : friendlyError(error) };
  return done('form');
}

export async function saveFaq(_: ActionState, f: FormData): Promise<ActionState> {
  const sb = await admin();
  const p = z.object({
    id: z.string().uuid().optional(),
    question: str(300).min(5, 'Add the question.'),
    answer: str(3000).min(2, 'Add the answer.'),
    topic: str(60).min(2, 'Add a topic.'),
    sort: z.coerce.number().int().min(0).max(1000),
    published: z.boolean(),
  }).safeParse({ id: f.get('id') || undefined, question: f.get('question'), answer: f.get('answer'), topic: f.get('topic'), sort: f.get('sort') || 0, published: f.get('published') === 'on' });
  if (!p.success) return { error: p.error.issues[0].message };
  const { id, ...row } = p.data;
  const { error } = id ? await sb.from('faqs').update(row).eq('id', id) : await sb.from('faqs').insert(row);
  if (error) return { error: friendlyError(error) };
  return done('faqs');
}

export async function saveAuthority(_: ActionState, f: FormData): Promise<ActionState> {
  const sb = await admin();
  const p = z.object({
    id: z.string().uuid().optional(),
    name: str(200).min(2, 'Add the name.'),
    remit: str(300), phone: str(40), email: z.union([z.literal(''), z.string().trim().email('Check the email address.')]),
    website: optUrl, sort: z.coerce.number().int().min(0).max(1000),
  }).safeParse({ id: f.get('id') || undefined, name: f.get('name'), remit: f.get('remit') ?? '', phone: f.get('phone') ?? '', email: f.get('email') ?? '', website: f.get('website') ?? '', sort: f.get('sort') || 0 });
  if (!p.success) return { error: p.error.issues[0].message };
  const { id, ...r } = p.data;
  const row = { ...r, remit: r.remit || null, phone: r.phone || null, email: r.email || null, website: r.website || null };
  const { error } = id ? await sb.from('authorities').update(row).eq('id', id) : await sb.from('authorities').insert(row);
  if (error) return { error: friendlyError(error) };
  return done('authorities');
}

export async function savePage(_: ActionState, f: FormData): Promise<ActionState> {
  const sb = await admin();
  const p = z.object({ slug: z.string().regex(/^[a-z0-9-]{2,40}$/), title: str(200).min(2), body: str(20000) })
    .safeParse({ slug: f.get('slug'), title: f.get('title'), body: f.get('body') ?? '' });
  if (!p.success) return { error: 'Check the title and text.' };
  const { error } = await sb.from('pages').upsert({ ...p.data, updated_at: new Date().toISOString() });
  if (error) return { error: friendlyError(error) };
  return done('pages');
}

export async function deleteRow(f: FormData) {
  const sb = await admin();
  const table = z.enum(['faqs', 'authorities', 'documents', 'public_holidays']).parse(f.get('table'));
  const id = String(f.get('id'));
  if (table === 'public_holidays') {
    await sb.from('public_holidays').delete().eq('day', z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(id));
  } else {
    const uid = z.string().uuid().parse(id);
    if (table === 'documents') {
      const { data } = await sb.from('documents').select('storage_path').eq('id', uid).single();
      if (data) await sb.storage.from('documents').remove([data.storage_path]);
    }
    await sb.from(table).delete().eq('id', uid);
  }
  revalidatePath('/app/admin');
  revalidatePath('/help');
}

export async function addHoliday(_: ActionState, f: FormData): Promise<ActionState> {
  const sb = await admin();
  const p = z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.'), name: str(100).min(2, 'Name the holiday.') })
    .safeParse({ day: f.get('day'), name: f.get('name') });
  if (!p.success) return { error: p.error.issues[0].message };
  const { error } = await sb.from('public_holidays').upsert(p.data);
  if (error) return { error: friendlyError(error) };
  return done('holidays');
}

export async function addDocument(_: ActionState, f: FormData): Promise<ActionState> {
  const sb = await admin();
  const file = f.get('file');
  const title = String(f.get('title') ?? '').trim().slice(0, 200);
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a file.' };
  if (file.size > 10 * 1024 * 1024) return { error: 'Files can be up to 10 MB.' };
  if (!/\.(pdf|docx|xlsx|pptx)$/i.test(file.name)) return { error: 'Use PDF, Word, Excel or PowerPoint.' };
  if (title.length < 2) return { error: 'Give the document a title.' };
  const path = `${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]+/g, '_').slice(-80)}`;
  const up = await sb.storage.from('documents').upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) return { error: 'Upload failed. Please try again.' };
  const { error } = await sb.from('documents').insert({ title, description: String(f.get('description') ?? '').slice(0, 300) || null, storage_path: path });
  if (error) return { error: friendlyError(error) };
  return done('documents', 'Uploaded.');
}
