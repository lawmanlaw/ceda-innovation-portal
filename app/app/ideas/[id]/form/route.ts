import { NextResponse } from 'next/server';
import { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { getMe, supabaseServer } from '@/lib/supabase/server';

// The idea as a Word document with a blank evaluation sheet, for offline comments.
// Row-level security decides who may download it, exactly as on the idea page.
const FONT = 'Times New Roman';
const p = (text: string, opts: { bold?: boolean; size?: number; italics?: boolean } = {}) =>
  new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: [new TextRun({ text, font: FONT, size: (opts.size ?? 12) * 2, bold: opts.bold, italics: opts.italics })] });
const h = (text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_2) =>
  new Paragraph({ heading: level, spacing: { before: 240, after: 120 }, children: [new TextRun({ text, font: FONT, bold: true, color: '7A1E1E', size: level === HeadingLevel.HEADING_1 ? 36 : 28 })] });
const cell = (text: string, w: number, bold = false) =>
  new TableCell({ width: { size: w, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text, font: FONT, size: 22, bold })] })] });

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getMe())) return new NextResponse('Sign in first', { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('Not found', { status: 404 });
  const sb = await supabaseServer();
  const { data: idea } = await sb.from('ideas').select('ref, title, summary, district, answers, stage, version, submitted_at, categories(name)').eq('id', id).maybeSingle();
  if (!idea) return new NextResponse('Not found', { status: 404 });
  const [{ data: fields }, { data: criteria }] = await Promise.all([
    sb.from('form_fields').select('key, label').eq('active', true).order('sort'),
    sb.from('criteria').select('name, description, max_score').eq('active', true).order('sort'),
  ]);
  const answers = (idea.answers ?? {}) as Record<string, string>;
  const cat = (idea as unknown as { categories: { name: string } | null }).categories?.name ?? '';
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'C9BCB5' };
  const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };

  const doc = new Document({
    creator: 'CEDA Innovation Portal',
    title: `${idea.ref} ${idea.title}`,
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [{
      children: [
        h(idea.title, HeadingLevel.HEADING_1),
        p(`${idea.ref} · version ${idea.version} · ${cat} · ${idea.district}${idea.submitted_at ? ` · submitted ${new Date(idea.submitted_at).toLocaleDateString('en-GB')}` : ''}`, { italics: true, size: 11 }),
        h('Summary'), p(idea.summary ?? ''),
        ...(fields ?? []).flatMap((f) => (answers[f.key] ? [h(f.label), p(answers[f.key])] : [])),
        h('Evaluation sheet'),
        p('Score each category from 1 (Poor) to 5 (Excellent) and add your comments.', { italics: true, size: 11 }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE }, borders,
          rows: [
            new TableRow({ tableHeader: true, children: [cell('Category', 34, true), cell('Score (1 to 5)', 14, true), cell('Comments', 52, true)] }),
            ...(criteria ?? []).map((c) => new TableRow({ height: { value: 900, rule: 'atLeast' }, children: [cell(`${c.name}\n${c.description ?? ''}`, 34), cell('', 14), cell('', 52)] })),
          ],
        }),
        h('Overall comments and recommendation'),
        p(' '), p(' '), p(' '),
        p('Reviewer name: ______________________     Date: ______________'),
      ],
    }],
  });
  const buf = await Packer.toBuffer(doc);
  const name = `${idea.ref ?? 'idea'}-${idea.title}`.replace(/[^\w\- ]+/g, '').slice(0, 80).trim();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${name}.docx"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
