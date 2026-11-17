import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { Role } from '@/lib/types';

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // called from a server component; middleware refreshes the session instead
        }
      },
    },
  });
}

export type Me = {
  photo_v: number;
  id: string;
  email: string | null;
  full_name: string;
  role: Role;
  district: string | null;
  organisation: string | null;
  phone: string | null;
  alerts_email: boolean;
  alerts_in_app: boolean;
};

// One lookup per request, verified with the auth server (getUser, not getSession)
export const getMe = cache(async (): Promise<Me | null> => {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: p } = await sb
    .from('profiles')
    .select('id, email, full_name, role, district, organisation, phone, alerts_email, alerts_in_app, photo_v')
    .eq('id', data.user.id)
    .single();
  return (p as Me) ?? null;
});

export async function requireMe(...roles: Role[]) {
  const me = await getMe();
  if (!me) redirect('/login');
  if (roles.length && !roles.includes(me.role)) redirect('/app');
  return me;
}
