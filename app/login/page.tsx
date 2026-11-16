import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMe, supabaseServer } from '@/lib/supabase/server';
import AuthForm from './auth-form';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string; error?: string }> }) {
  if (await getMe()) redirect('/app');
  const { mode, error } = await searchParams;
  const sb = await supabaseServer();
  const { data: districts } = await sb.from('districts').select('name').order('name');
  return (
    <main id="main">
      <div className="wrap" style={{ maxWidth: 440 }}>
        <p><Link href="/" className="brand"><img src="/ceda-logo.png" alt="CEDA" width={67} height={40} /><span>Innovation Portal</span></Link></p>
        <div className="card">
          {error === 'oauth' && <p className="notice bad">Google sign-in did not finish. Please try again or use your email.</p>}
          <AuthForm initialMode={mode === 'signup' ? 'signup' : 'signin'} districts={(districts ?? []).map((d) => d.name)} />
        </div>
      </div>
    </main>
  );
}
