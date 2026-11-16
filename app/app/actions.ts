'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireMe, supabaseServer } from '@/lib/supabase/server';
import { friendlyError } from '@/lib/util';
import { scanFile } from '@/lib/file-scan';

export type ActionState = { error?: string | null; ok?: string | null };

const uuid = z.string().uuid();

const ideaSchema = z.object({
  title: z.string().trim().min(5, 'Give your idea a title of at least 5 characters.').max(150),
  summary: z.string().trim().min(20, 'The summary needs at least 20 characters.').max(600),
  category: z.coerce.number().int().positive('Choose a category.'),
  district: z.string().trim().min(2, 'Choose a district.'),
});

function readIdea(f: FormData) {
  const base = ideaSchema.safeParse({
    title: f.get('title'),
    summary: f.get('summary'),
    category: f.get('category'),
    district: f.get('district'),
  });
  const answers: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (k.startsWith('a_') && typeof v === 'string') answers[k.slice(2)] = v.slice(0, 5000);
  return { base, answers };
}

export async function resubmitIdea(_: ActionState, f: FormData): Promise<ActionState> {
  await requireMe();
  const id = uuid.safeParse(f.get('idea_id'));
  const { base, answers } = readIdea(f);
  if (!id.success) return { error: 'Not found.' };
  if (!base.success) return { error: base.error.issues[0].message };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('resubmit_idea', {
    p_idea: id.data,
    p_title: base.data.title,
    p_summary: base.data.summary,
    p_category: base.data.category,
    p_district: base.data.district,
    p_answers: answers,
    p_note: String(f.get('note') ?? '').slice(0, 1000),
  });
  if (error) return { error: friendlyError(error) };
  redirect(`/app/ideas/${id.data}`);
}

export async function withdrawIdea(f: FormData) {
  await requireMe('submitter');
  const id = uuid.parse(f.get('idea_id'));
  const sb = await supabaseServer();
  await sb.rpc('withdraw_idea', { p_idea: id });
  revalidatePath(`/app/ideas/${id}`);
}

export async function moveIdea(_: ActionState, f: FormData): Promise<ActionState> {
  await requireMe('adjudicator', 'admin');
  const id = uuid.safeParse(f.get('idea_id'));
  const to = z.enum(['in_review', 'feedback', 'approved', 'awarded', 'rejected']).safeParse(f.get('to'));
  if (!id.success || !to.success) return { error: 'Choose a decision.' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('move_idea', { p_idea: id.data, p_to: to.data, p_note: String(f.get('note') ?? '').slice(0, 2000) });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/app/ideas/${id.data}`);
  return { ok: 'Saved. The submitter has been notified.' };
}

export async function assignEvaluator(_: ActionState, f: FormData): Promise<ActionState> {
  await requireMe('adjudicator', 'admin');
  const id = uuid.safeParse(f.get('idea_id'));
  const ev = uuid.safeParse(f.get('evaluator_id'));
  if (!id.success || !ev.success) return { error: 'Choose an evaluator.' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('assign_evaluator', { p_idea: id.data, p_evaluator: ev.data });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/app/ideas/${id.data}`);
  return { ok: 'Evaluator assigned.' };
}

export async function unassignEvaluator(f: FormData) {
  await requireMe('adjudicator', 'admin');
  const id = uuid.parse(f.get('idea_id'));
  const ev = uuid.parse(f.get('evaluator_id'));
  const sb = await supabaseServer();
  await sb.rpc('unassign_evaluator', { p_idea: id, p_evaluator: ev });
  revalidatePath(`/app/ideas/${id}`);
}

export async function saveScores(_: ActionState, f: FormData): Promise<ActionState> {
  await requireMe('evaluator');
  const id = uuid.safeParse(f.get('idea_id'));
  if (!id.success) return { error: 'Not found.' };
  const final = f.get('final') === '1';
  const scores: Record<string, { score: number | null; comment: string }> = {};
  for (const [k, v] of f.entries()) {
    const m = /^(score|comment)_([0-9a-f-]{36})$/.exec(k);
    if (!m) continue;
    scores[m[2]] ??= { score: null, comment: '' };
    if (m[1] === 'score') scores[m[2]].score = v === '' ? null : Number(v);
    else scores[m[2]].comment = String(v).slice(0, 1000);
  }
  for (const k of Object.keys(scores)) if (scores[k].score === null) delete scores[k];
  const sb = await supabaseServer();
  const { error } = await sb.rpc('save_scores', { p_idea: id.data, p_scores: scores, p_final: final });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/app/ideas/${id.data}`);
  return { ok: final ? 'Scores submitted. Thank you.' : 'Draft saved.' };
}

export async function postFeedback(_: ActionState, f: FormData): Promise<ActionState> {
  const me = await requireMe();
  const id = uuid.safeParse(f.get('idea_id'));
  const body = z.string().trim().min(1, 'Write a message first.').max(4000).safeParse(f.get('body'));
  if (!id.success) return { error: 'Not found.' };
  if (!body.success) return { error: body.error.issues[0].message };
  const internal = f.get('internal') === '1' && me.role !== 'submitter';
  const sb = await supabaseServer();
  const { error } = await sb.from('feedback').insert({ idea_id: id.data, author_id: me.id, body: body.data, internal });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/app/ideas/${id.data}`);
  return { ok: 'Posted.' };
}

export async function recordAttachment(ideaId: string, path: string, name: string): Promise<ActionState> {
  const me = await requireMe('submitter');
  const id = uuid.safeParse(ideaId);
  if (!id.success || !path.startsWith(`${id.data}/`) || path.includes('..')) return { error: 'Upload failed.' };
  const sb = await supabaseServer();
  // Read back what actually landed in storage and check its real contents before anyone can see it
  const { data: blob, error: readErr } = await sb.storage.from('idea-files').download(path);
  if (readErr || !blob) return { error: 'Upload failed. Please try again.' };
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const verdict = scanFile(name, bytes);
  if (!verdict.ok) {
    await sb.storage.from('idea-files').remove([path]);
    await sb.rpc('log_blocked_upload', { p_idea: id.data, p_file: name.slice(0, 200), p_reason: verdict.reason });
    return { error: verdict.reason };
  }
  const { error } = await sb.from('attachments').insert({ idea_id: id.data, storage_path: path, file_name: name.slice(0, 200), size_bytes: bytes.byteLength, uploaded_by: me.id });
  if (error) {
    await sb.storage.from('idea-files').remove([path]);
    return { error: friendlyError(error) };
  }
  revalidatePath(`/app/ideas/${id.data}`);
  return { ok: 'Uploaded and checked.' };
}

export async function removeAttachment(f: FormData) {
  await requireMe('submitter');
  const id = uuid.parse(f.get('attachment_id'));
  const sb = await supabaseServer();
  const { data } = await sb.from('attachments').delete().eq('id', id).select('idea_id, storage_path').single();
  if (data) {
    await sb.storage.from('idea-files').remove([data.storage_path]);
    revalidatePath(`/app/ideas/${data.idea_id}`);
  }
}

export async function updateProfile(_: ActionState, f: FormData): Promise<ActionState> {
  const me = await requireMe();
  const p = z.object({
    full_name: z.string().trim().min(2, 'Enter your name.').max(120),
    organisation: z.string().trim().max(120),
    phone: z.string().trim().max(20).regex(/^[0-9+ ]*$/, 'Use digits only for the phone number.'),
    district: z.string().trim().max(60),
  }).safeParse(Object.fromEntries(['full_name', 'organisation', 'phone', 'district'].map((k) => [k, f.get(k) ?? ''])));
  if (!p.success) return { error: p.error.issues[0].message };
  const sb = await supabaseServer();
  const { error } = await sb.from('profiles').update({
    ...p.data,
    alerts_email: f.get('alerts_email') === 'on',
    alerts_in_app: f.get('alerts_in_app') === 'on',
  }).eq('id', me.id);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/app/profile');
  return { ok: 'Saved.' };
}
