import { NextResponse } from 'next/server';
import { getMe, supabaseServer } from '@/lib/supabase/server';

// Cells starting with = + - @ are prefixed so spreadsheets don't run them as formulas
const cell = (v: unknown) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET() {
  const me = await getMe();
  if (!me || !['admin', 'adjudicator'].includes(me.role)) return new NextResponse('Not allowed', { status: 403 });
  const sb = await supabaseServer();
  const { data } = await sb.from('ideas').select('ref, title, district, stage, version, submitted_at, stage_changed_at, categories(name)').order('submitted_at');
  const rows = (data ?? []) as unknown as { ref: string; title: string; district: string; stage: string; version: number; submitted_at: string; stage_changed_at: string; categories: { name: string } | null }[];
  const lines = [
    ['Reference', 'Title', 'Category', 'District', 'Stage', 'Version', 'Submitted', 'Last change'].map(cell).join(','),
    ...rows.map((r) => [r.ref, r.title, r.categories?.name, r.district, r.stage, r.version, r.submitted_at, r.stage_changed_at].map(cell).join(',')),
  ];
  return new NextResponse(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ceda-ideas-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
