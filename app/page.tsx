import Link from 'next/link';
import { getMe } from '@/lib/supabase/server';
import { STAGES } from '@/lib/types';

export default async function Home() {
  const me = await getMe();
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Link href="/" className="brand"><img src="/ceda-logo.png" alt="CEDA" width={67} height={40} /><span>Innovation Portal</span></Link>
          <nav className="nav" aria-label="Main">
            <Link href="/help">Help</Link>
            {me ? <Link href="/app">My dashboard</Link> : <Link href="/login">Sign in</Link>}
          </nav>
        </div>
      </header>
      <main id="main">
        <div className="wrap stack">
          <section className="hero">
            <div>
            <h1>Bring your idea to CEDA</h1>
            <p>
              Submit an idea that could grow a business, create jobs or improve how CEDA works. Follow every step of its
              review, talk to the panel, and get recognised when it is taken forward.
            </p>
            <div className="row">
              <Link className="btn" href={me ? '/app/ideas/new' : '/login?mode=signup'}>Submit an idea</Link>
              <Link className="btn secondary" href="/help">How it works</Link>
            </div>
            </div>
            <div className="rings" aria-hidden><span /><span /><span /><span /></div>
          </section>

          <section className="card">
            <h2>What happens after you submit</h2>
            <ol className="grid cols-4" style={{ paddingLeft: '1.1rem', margin: 0 }}>
              {STAGES.map((s) => (
                <li key={s.key}>
                  <strong>{s.label}</strong>
                  <br />
                  <span className="muted">
                    {
                      {
                        submitted: 'We confirm receipt and check it is complete.',
                        in_review: 'Evaluators score it against published criteria.',
                        feedback: 'You may be asked to improve and resubmit.',
                        approved: 'The adjudication panel takes it forward.',
                        awarded: 'Recognition and support from CEDA.',
                      }[s.key as 'submitted']
                    }
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="grid cols-2">
            <div className="card">
              <h3>Always know where you stand</h3>
              <p className="muted">Your dashboard shows the stage of every idea, and you get an alert whenever something changes.</p>
            </div>
            <div className="card">
              <h3>Talk to a consultant</h3>
              <p className="muted">Live chat with CEDA staff from 09:00 to 16:00 on working days, right from your dashboard.</p>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
