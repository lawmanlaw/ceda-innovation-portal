import { NextResponse } from 'next/server';

// Uptime monitors call this; it checks the database answers without exposing any data
export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/districts?select=id&limit=1`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
      cache: 'no-store',
    });
    return NextResponse.json({ ok: res.ok, db_ms: Date.now() - started }, { status: res.ok ? 200 : 503 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
