import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

// Photos show only for approved challenges (or to admins while moderating). They were re-encoded on upload.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse('Not found', { status: 404 });
  const sb = await supabaseServer();
  const { data: c } = await sb.from('challenges').select('status, has_photo').eq('id', id).maybeSingle();
  if (!c) return new NextResponse('Not found', { status: 404 });
  const { data } = await sb.rpc('challenge_photo', { p_challenge: id });
  const row = (data as { mime: string; data: string }[] | null)?.[0];
  if (!row) return new NextResponse('Not found', { status: 404 });
  const bytes = Buffer.from(row.data.replace(/^\\x/, ''), 'hex');
  return new NextResponse(new Uint8Array(bytes), {
    headers: { 'Content-Type': row.mime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': c.status === 'approved' ? 'public, max-age=3600' : 'private, no-store' },
  });
}
