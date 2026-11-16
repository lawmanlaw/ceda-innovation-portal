import 'server-only';
import { inflateSync } from 'node:zlib';
import { unzipSync } from 'fflate';

// Server-side safety check for innovator uploads. Runs on every upload and again on every download,
// so a file that skipped the upload check is still never handed to an evaluator.
// It checks what the file really is (its first bytes), not what its name or browser claims, and
// refuses content that can run code when opened: macros, ActiveX, embedded programs, PDF scripts.

export const MAX_BYTES = 10 * 1024 * 1024;
export type ScanResult = { ok: true; kind: Kind; mime: string } | { ok: false; reason: string };
type Kind = 'pdf' | 'png' | 'jpg' | 'webp' | 'docx' | 'pptx' | 'xlsx';

const EXT: Record<string, Kind> = { pdf: 'pdf', png: 'png', jpg: 'jpg', jpeg: 'jpg', webp: 'webp', docx: 'docx', pptx: 'pptx', xlsx: 'xlsx' };
export const MIME: Record<Kind, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
export const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.docx,.pptx,.xlsx';

// EICAR is the industry standard harmless test string every antivirus treats as a virus
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
const SCRIPTY = /<script|<\?php|<html|<iframe|javascript:|<svg[\s>]/i;
const PDF_ACTIVE = /\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia|XFA|SubmitForm|ImportData|GoToR)\b/;
const OOXML_BAD_PARTS = /(^|\/)(vbaProject\.bin|vbaData\.xml|activeX\/|oleObject[^/]*$)/i;
// Word and PowerPoint store charts as small embedded workbooks; those are fine, anything else embedded is not
const SAFE_EMBED = /\/embeddings\/[^/]+\.(xlsx|docx|pptx)$/i;

const starts = (b: Uint8Array, sig: number[]) => sig.every((v, i) => b[i] === v);
const latin1 = (b: Uint8Array) => Buffer.from(b.buffer, b.byteOffset, b.byteLength).toString('latin1');
const bad = (reason: string): ScanResult => ({ ok: false, reason });

function sniff(b: Uint8Array): Kind | 'zip' | null {
  if (starts(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf';
  if (starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (starts(b, [0xff, 0xd8, 0xff])) return 'jpg';
  if (starts(b, [0x52, 0x49, 0x46, 0x46]) && latin1(b.subarray(8, 12)) === 'WEBP') return 'webp';
  if (starts(b, [0x50, 0x4b, 0x03, 0x04])) return 'zip';
  return null;
}

function scanPdf(b: Uint8Array): ScanResult | null {
  const text = latin1(b);
  if (PDF_ACTIVE.test(text)) return bad('This PDF contains scripts, embedded files or launch actions. Save it again as a plain PDF (Print to PDF works) and upload that.');
  // Names can hide inside compressed streams, so open those too (with a size cap against zip bombs)
  let opened = 0;
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && opened < 400) {
    const start = m.index + m[0].length;
    const end = text.indexOf('endstream', start);
    if (end < 0) break;
    try {
      const out = inflateSync(b.subarray(start, end), { maxOutputLength: 8 * 1024 * 1024 });
      opened++;
      if (PDF_ACTIVE.test(latin1(out))) return bad('This PDF contains hidden scripts or embedded files. Save it again as a plain PDF and upload that.');
    } catch { /* not a compressed stream, or an image: nothing to read */ }
    re.lastIndex = end;
  }
  return null;
}

function scanOoxml(b: Uint8Array, want: Kind): ScanResult | null {
  let total = 0;
  let count = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(b, {
      filter: (f) => {
        count++;
        total += f.originalSize;
        if (count > 3000 || total > 100 * 1024 * 1024) throw new Error('bomb');
        return true;
      },
    });
  } catch (e) {
    return bad((e as Error).message === 'bomb' ? 'This file expands to an unsafe size and was refused.' : 'This file is damaged or is not a real Office document.');
  }
  const names = Object.keys(files);
  const types = files['[Content_Types].xml'];
  if (!types) return bad('This is not a real Office document.');
  const ct = latin1(types);
  const main = { docx: 'wordprocessingml.document.main', pptx: 'presentationml.presentation.main', xlsx: 'spreadsheetml.sheet.main' }[want as 'docx'];
  if (!ct.includes(main)) return bad(`This file is not really a .${want} document.`);
  if (/macroEnabled|vbaProject/i.test(ct)) return bad('This document contains macros. Save it as a normal .docx, .pptx or .xlsx without macros and upload again.');
  const part = names.find((n) => OOXML_BAD_PARTS.test(n) || (/\/embeddings\//i.test(n) && !SAFE_EMBED.test(n)));
  if (part) return bad('This document contains macros, ActiveX controls or embedded programs. Remove them and upload again.');
  for (const n of names) {
    if (!n.endsWith('.rels') && !n.endsWith('.xml')) continue;
    const x = latin1(files[n]);
    if (n.endsWith('.rels') && /TargetMode="External"/i.test(x) && /attachedTemplate|oleObject|frame|subDocument/i.test(x)) {
      return bad('This document loads content from the internet when opened. Remove linked templates or objects and upload again.');
    }
    if (/\bDDE(AUTO)?\b/.test(x) && /instrText|fldSimple/.test(x)) return bad('This document contains automatic links that can run commands. Remove them and upload again.');
    if (x.includes(EICAR)) return bad('A malware signature was found in this file.');
  }
  return null;
}

export function scanFile(name: string, bytes: Uint8Array): ScanResult {
  if (bytes.byteLength === 0) return bad('This file is empty.');
  if (bytes.byteLength > MAX_BYTES) return bad('Files can be up to 10 MB.');
  const ext = name.toLowerCase().split('.').pop() ?? '';
  const want = EXT[ext];
  if (!want) return bad('Use PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx) or an image (PNG, JPG, WEBP). Older .doc files are not accepted because they can carry macros.');
  const real = sniff(bytes);
  const fits = real === want || (real === 'zip' && ['docx', 'pptx', 'xlsx'].includes(want));
  if (!fits) return bad(`This file is named .${ext} but its contents are something else, so it was refused.`);
  const text = latin1(bytes);
  if (text.includes(EICAR)) return bad('A malware signature was found in this file.');
  if (text.includes('MZ') && /This program cannot be run in DOS mode/.test(text)) return bad('This file has a Windows program hidden inside it.');
  const problem = want === 'pdf' ? scanPdf(bytes)
    : real === 'zip' ? scanOoxml(bytes, want)
    : SCRIPTY.test(text) ? bad('This image has web code hidden inside it, so it was refused.') : null;
  return problem ?? { ok: true, kind: want, mime: MIME[want] };
}
