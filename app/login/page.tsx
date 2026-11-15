import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMe, supabaseServer } from '@/lib/supabase/server';
import AuthForm from './auth-form';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  if (await getMe()) redirect('/app');
  const { mode } = await searchParams;
  const sb = await supabaseServer();
  const { data: districts } = await sb.from('districts').select('name').order('name');
  return (
    <main id="main">
      <div className="wrap" style={{ maxWidth: 440 }}>
        <p><Link href="/" className="brand">CEDA Innovation Portal</Link></p>
        <div className="card">
          <AuthForm initialMode={mode === 'signup' ? 'signup' : 'signin'} districts={(districts ?? []).map((d) => d.name)} />
        </div>
      </div>
    </main>
  );
}
