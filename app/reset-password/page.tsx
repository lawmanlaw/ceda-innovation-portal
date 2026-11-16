import { redirect } from 'next/navigation';
import { getMe } from '@/lib/supabase/server';
import ResetForm from './reset-form';

export const metadata = { title: 'Choose a new password' };

export default async function ResetPassword() {
  if (!(await getMe())) redirect('/login?error=oauth');
  return (
    <main id="main">
      <div className="wrap card stack" style={{ maxWidth: 440, marginTop: '3rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Choose a new password</h1>
        <ResetForm />
      </div>
    </main>
  );
}
