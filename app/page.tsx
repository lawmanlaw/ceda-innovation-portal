import Link from 'next/link';
import { getMe } from '@/lib/supabase/server';
import { STAGES } from '@/lib/types';
import Icon from '@/components/icon';

const STEP = {
  submitted: ['send', 'We confirm receipt and check it is complete.'],
  in_review: ['review', 'Evaluators score it against published criteria.'],
  feedback: ['chat', 'You may be asked to improve and resubmit.'],
  approved: ['check', 'The adjudication panel takes it forward.'],
  awarded: ['award', 'Recognition and support from CEDA.'],
} as const;

const SECTORS = [
  ['cabbages', 'Agriculture', 'Horticulture, crops and agro-processing', 'Rows of cabbages growing in red soil'],
  ['factory', 'Manufacturing', 'Local production and value addition', 'Workers operating a textile machine'],
  ['tractor', 'Mechanisation', 'Equipment and services for farmers', 'A tractor with a planter in a field'],
  ['poultry', 'Small business', 'Poultry, retail and services', 'A poultry farmer beside her hens'],
];

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const me = await getMe();
  const start = me ? '/app/ideas/new' : '/login?mode=signup';
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Link href="/" className="brand"><span className="brand-mark"><img src="/ceda-logo.png" alt="CEDA" width={67} height={40} /></span><i className="brand-rule" aria-hidden="true" /><span className="brand-name"><span>Innovation Portal</span></span></Link>
          <nav className="nav" aria-label="Main">
            <Link href="/help">Help</Link>
            {me ? <Link href="/app">My dashboard</Link> : <Link href="/login">Sign in</Link>}
          </nav>
        </div>
      </header>
      <main id="main">
        <div className="wrap stack">
          {deleted && <p className="notice" role="status">Your account and all your submissions have been deleted.</p>}
          <section className="hero">
            <div>
              <h1>Bring your idea to CEDA</h1>
              <p>
                Submit an idea that could grow a business, create jobs or improve how CEDA works. Follow every step of its
                review, talk to the panel, and get recognised when it is taken forward.
              </p>
              <div className="row">
                <Link className="btn" href={start}>Submit an idea</Link>
                <Link className="btn secondary" href="/help">How it works</Link>
              </div>
            </div>
            <img className="photo hero-photo" src="/img/gaborone.webp" alt="Gaborone seen from the air at sunrise" fetchPriority="high" />
          </section>

          <section className="card">
            <h2>What happens after you submit</h2>
            <ol className="steps">
              {STAGES.map((s) => {
                const [icon, text] = STEP[s.key as keyof typeof STEP];
                return (
                  <li key={s.key}>
                    <Icon name={icon} />
                    <strong>{s.label}</strong>
                    <span className="muted">{text}</span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section>
            <h2>Ideas from every sector</h2>
            <div className="tiles">
              {SECTORS.map(([img, title, text, alt]) => (
                <figure key={img} className="tile">
                  <div><img className="photo" src={`/img/${img}.webp`} alt={alt} loading="lazy" decoding="async" /></div>
                  <figcaption><strong>{title}</strong><br /><span className="muted">{text}</span></figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section className="grid cols-2">
            <div className="card">
              <Icon name="review" />
              <h3>Always know where you stand</h3>
              <p className="muted">Your dashboard shows the stage of every idea, and you get an alert whenever something changes.</p>
            </div>
            <div className="card">
              <Icon name="chat" />
              <h3>Talk to a consultant</h3>
              <p className="muted">Live chat with CEDA staff from 09:00 to 16:00 on working days, right from your dashboard.</p>
            </div>
          </section>

          <section className="band">
            <img src="/img/bulbs.webp" alt="" loading="lazy" decoding="async" />
            <div>
              <Icon name="bulb" className="big" />
              <h2>Have an idea worth backing?</h2>
              <p>It takes about 10 minutes to submit, and you can follow it all the way to a decision.</p>
              <Link className="btn" href={start}>Submit an idea</Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
