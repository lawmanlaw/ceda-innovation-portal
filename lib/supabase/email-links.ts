'use client';
import { createClient } from '@supabase/supabase-js';

// Used only to send email links (sign-up, sign-in link, password reset).
// The implicit flow puts the session in the link itself, so it signs the person in
// on whichever device they open the email on, not only the one they started on.
let client: ReturnType<typeof createClient> | undefined;

export function emailLinkClient() {
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
