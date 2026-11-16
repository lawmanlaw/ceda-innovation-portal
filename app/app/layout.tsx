import Link from 'next/link';
import { requireMe } from '@/lib/supabase/server';
import { ROLE_LABEL, type Role } from '@/lib/types';
import NavLinks from '@/components/nav-links';
import Notifications from '@/components/notifications';

const NAV: Record<Role, [string, string][]> = {
  submitter: [['/app', 'My ideas'], ['/app/ideas/new', 'Submit an idea'], ['/app/chat', 'Chat with CEDA']],
  evaluator: [['/app', 'To evaluate']],
  adjudicator: [['/app', 'Overview'], ['/app/ideas', 'All ideas'], ['/app/reports', 'Reports']],
  admin: [['/app', 'Overview'], ['/app/ideas', 'All ideas'], ['/app/reports', 'Reports'], ['/app/agent', 'Live chat'], ['/app/admin', 'Settings'], ['/app/audit', 'Audit trail']],
  agent: [['/app/agent', 'Live chat']],
  observer: [['/app/ideas', 'All ideas']],
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Link href="/app" className="brand"><img src="/ceda-logo.png" alt="CEDA" width={67} height={40} /><span>Innovation Portal</span></Link>
          <NavLinks links={[...NAV[me.role], ['/help', 'Help']]} />
          <Notifications userId={me.id} />
          <details style={{ position: 'relative' }}>
            <summary className="btn ghost small" style={{ listStyle: 'none' }} aria-label="Account">
              {me.full_name || me.email}
            </summary>
            <div className="card" style={{ position: 'absolute', right: 0, top: '110%', width: 240, zIndex: 30 }}>
              <p className="muted" style={{ marginBottom: '.5rem' }}>{ROLE_LABEL[me.role]}</p>
              <Link href="/app/profile" className="btn ghost small" style={{ width: '100%', justifyContent: 'flex-start' }}>Profile and alerts</Link>
              <form action="/auth/signout" method="post">
                <button className="btn ghost small" style={{ width: '100%', justifyContent: 'flex-start' }}>Sign out</button>
              </form>
            </div>
          </details>
        </div>
      </header>
      <main id="main">
        <div className="wrap">{children}</div>
      </main>
    </>
  );
}
