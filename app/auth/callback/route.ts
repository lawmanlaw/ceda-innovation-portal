import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { safeNext } from '@/lib/util';

// Email links and Google sign-in both return here with a one-time code
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as 'email' | 'recovery' | 'signup' | 'magiclink' | null;
  const next = safeNext(url.searchParams.get('next'));
  const sb = await supabaseServer();
  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  } else if (tokenHash && type) {
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(type === 'recovery' ? '/reset-password' : next, url.origin));
  }
  return NextResponse.redirect(new URL('/login?error=oauth', url.origin));
}
