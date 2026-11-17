'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { cleanPhoto, deviceKey, humanOk, netKey } from '@/lib/community';
import { locationFacts } from '@/lib/geo';

export type ReportState = { error?: string; code?: string };

const Report = z.object({
  title: z.string().trim().min(8, 'Give the problem a short title, at least 8 characters.').max(120),
  description: z.string().trim().min(20, 'Describe the problem in at least 20 characters.').max(1500),
  sector: z.string().trim().max(60).optional(),
  lat: z.coerce.number().min(-27).max(-17.6),
  lng: z.coerce.number().min(19.8).max(29.5),
});

export async function reportChallenge(_: ReportState, f: FormData): Promise<ReportState> {
  if (!(await humanOk(f.get('cf-turnstile-response')))) return { error: 'We could not confirm you are a person. Please try again.' };
  if (!f.get('lat')) return { error: 'Drop a pin on the map to show where the problem is.' };
  const p = Report.safeParse({ title: f.get('title'), description: f.get('description'), sector: f.get('sector') || undefined, lat: f.get('lat'), lng: f.get('lng') });
  if (!p.success) return { error: p.error.issues[0].message };
  const photo = await cleanPhoto(f.get('photo') as File | null);
  if (!photo.ok) return { error: photo.reason };
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('report_challenge', {
    p_device: await deviceKey(), p_net: await netKey(), p_title: p.data.title, p_description: p.data.description,
    p_sector: p.data.sector ?? null, p_district: locationFacts(p.data.lat, p.data.lng)?.district ?? null,
    p_lat: p.data.lat, p_lng: p.data.lng,
    p_photo: photo.data ? `\\x${photo.data.toString('hex')}` : null, p_mime: photo.data ? 'image/webp' : null,
  });
  if (error) return { error: error.code === '54000' ? error.message : 'We could not save your report. Please try again.' };
  return { code: data as string };
}

export async function upvote(id: string): Promise<{ n?: number; error?: string }> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return { error: 'Not found.' };
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('upvote_challenge', { p_net: await netKey(), p_device: await deviceKey(), p_challenge: id });
  if (error) return { error: error.code === '54000' ? error.message : 'Your vote did not go through.' };
  revalidatePath('/challenges');
  return { n: data as number };
}
