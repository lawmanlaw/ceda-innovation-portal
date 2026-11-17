import Link from 'next/link';
import { requireMe } from '@/lib/supabase/server';
import { ROLE_LABEL, type Role } from '@/lib/types';
import NavLinks from '@/components/nav-links';
import Notifications from '@/components/notifications';
import Dock from '@/components/dock';
import Tour from '@/components/tour';
import Sidebar from '@/components/sidebar';
import MenuCloser from '@/components/menu-closer';

const NAV: Record<Role, [string, string][]> = {
  submitter: [['/app', 'My ideas'], ['/app/challenges', 'Challenges'], ['/app/ideas/new', 'Submit an idea'], ['/app/chat', 'Chat with CEDA']],
  evaluator: [['/app', 'To evaluate']],
  adjudicator: [['/app', 'Overview'], ['/app/ideas', 'All ideas'], ['/app/reports', 'Reports']],
  admin: [['/app', 'Overview'], ['/app/ideas', 'All ideas'], ['/app/reports', 'Reports'], ['/app/agent', 'Live chat'], ['/app/moderation', 'Moderation'], ['/app/admin', 'Settings'], ['/app/audit', 'Audit trail']],
  agent: [['/app/agent', 'Live chat']],
  observer: [['/app/ideas', 'All ideas']],
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Link href="/app" className="brand"><span className="brand-mark"><img src="/ceda-logo.png" alt="CEDA" width={67} height={40} /></span><i className="brand-rule" aria-hidden="true" /><span className="brand-name"><span>Innovation Portal</span></span></Link>
          <NavLinks links={[...NAV[me.role], ['/help', 'Help']]} />
          <Notifications userId={me.id} />
          <details name="topmenu" style={{ position: 'relative' }}>
            <summary className="btn ghost small" style={{ listStyle: 'none' }} aria-label="Account">
              {me.full_name || me.email}
            </summary>
            <div className="card" style={{ position: 'absolute', right: 0, top: '110%', width: 240, zIndex: 30 }}>
              <p className="muted" style={{ marginBottom: '.5rem' }}>{ROLE_LABEL[me.role]}</p>
              <Link href="/app/profile" className="btn ghost small" style={{ width: '100%', justifyContent: 'flex-start' }}>Profile and alerts</Link>
              {me.role === 'submitter' && <Link href="/app?tour=1" className="btn ghost small" style={{ width: '100%', justifyContent: 'flex-start' }}>Replay the tour</Link>}
              <form action="/auth/signout" method="post">
                <button className="btn ghost small" style={{ width: '100%', justifyContent: 'flex-start' }}>Sign out</button>
              </form>
            </div>
          </details>
        </div>
      </header>
      <main id="main" className="has-dock">
        <div className="wrap app-shell">
          <Sidebar links={NAV[me.role]} helpHref={me.role === 'submitter' ? '/app/chat' : '/help'} />
          <div className="app-body">{children}</div>
        </div>
      </main>
      <Dock role={me.role} />
      {me.role === 'submitter' && <Tour />}
      <MenuCloser />
    </>
  );
}
