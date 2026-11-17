import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import sharp from 'sharp';
import { scanFile } from '@/lib/file-scan';

// Server-side guards for the no-login community features.

// Pepper for hashing device and network ids; works without it, stronger with it
const pepper = () => process.env.COMMUNITY_SERVER_KEY ?? 'ceda-portal';

const hash = (s: string) => createHash('sha256').update(`${pepper()}:${s}`).digest('hex').slice(0, 32);

// The caller's network, hashed so no IP address is ever stored
export async function netKey() {
  const h = await headers();
  const ip = h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  return hash(`net:${ip}`);
}

// One random id per browser, kept in an http-only cookie; only its hash reaches the database
export async function deviceKey() {
  const jar = await cookies();
  let id = jar.get('bw_device')?.value;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    id = randomUUID();
    jar.set('bw_device', id, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365, path: '/' });
  }
  return hash(`dev:${id}`);
}

// Cloudflare Turnstile, the invisible bot check. Skipped until the keys are set in the hosting settings.
export const botCheckOn = () => Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
export async function humanOk(token: FormDataEntryValue | null) {
  if (!botCheckOn()) return true;
  if (typeof token !== 'string' || !token) return false;
  const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token });
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    return Boolean(((await r.json()) as { success?: boolean }).success);
  } catch {
    return false;
  }
}

// Photo: check the real file type, then re-encode. Re-encoding drops all hidden metadata
// (GPS, phone model, dates) and anything hidden after the image data.
export async function cleanPhoto(file: File | null): Promise<{ ok: true; data: Buffer | null } | { ok: false; reason: string }> {
  if (!file || file.size === 0) return { ok: true, data: null };
  if (file.size > 8 * 1024 * 1024) return { ok: false, reason: 'Photos can be up to 8 MB.' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const verdict = scanFile(file.name || 'photo.jpg', bytes);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };
  if (!['png', 'jpg', 'webp'].includes(verdict.kind)) return { ok: false, reason: 'Use a JPG, PNG or WEBP photo.' };
  try {
    const data = await sharp(bytes, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    return { ok: true, data };
  } catch {
    return { ok: false, reason: 'That photo could not be read. Try another one.' };
  }
}
