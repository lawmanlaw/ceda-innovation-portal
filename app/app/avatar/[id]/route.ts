import { NextResponse } from 'next/server';
import { getMe, supabaseServer } from '@/lib/supabase/server';

// Profile photos: row-level security lets only the person and CEDA staff read them.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getMe())) return new NextResponse('Sign in first', { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('Not found', { status: 404 });
  const sb = await supabaseServer();
  const { data } = await sb.from('profile_photos').select('data').eq('user_id', id).maybeSingle();
  if (!data) return new NextResponse('Not found', { status: 404 });
  const bytes = Buffer.from(String(data.data).replace(/^\\x/, ''), 'hex');
  return new NextResponse(new Uint8Array(bytes), {
    headers: { 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=31536000, immutable' },
  });
}
