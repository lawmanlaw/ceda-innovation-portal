import { NextResponse } from 'next/server';
import { getMe, supabaseServer } from '@/lib/supabase/server';
import { scanFile } from '@/lib/file-scan';

// Every attachment download goes through here. Row-level security decides who may read it,
// the file is checked again, and it is sent as a download that the browser will not run.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!me) return new NextResponse('Sign in first', { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('Not found', { status: 404 });
  const sb = await supabaseServer();
  const { data: f } = await sb.from('attachments').select('file_name, storage_path').eq('id', id).maybeSingle();
  if (!f) return new NextResponse('Not found', { status: 404 });
  const { data: blob } = await sb.storage.from('idea-files').download(f.storage_path);
  if (!blob) return new NextResponse('Not found', { status: 404 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const verdict = scanFile(f.file_name, bytes);
  if (!verdict.ok) return new NextResponse(`This file was blocked by the safety check: ${verdict.reason}`, { status: 422 });
  const safeName = f.file_name.replace(/[^\w.\- ]+/g, '_');
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': verdict.mime,
      'Content-Disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(f.file_name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, no-store',
    },
  });
}
