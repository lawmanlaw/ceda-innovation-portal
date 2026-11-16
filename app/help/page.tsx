import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import FaqSearch from './faq-search';
import { initials, logoFor } from './authority-logo';

export const metadata = { title: 'Help' };
export const revalidate = 300;

export default async function Help() {
  const sb = await supabaseServer();
  const [{ data: faqs }, { data: authorities }, { data: pages }, { data: docs }] = await Promise.all([
    sb.from('faqs').select('id, question, answer, topic').eq('published', true).order('sort'),
    sb.from('authorities').select('id, name, remit, phone, email, website').order('sort'),
    sb.from('pages').select('slug, title, body').in('slug', ['about', 'privacy', 'support']),
    sb.from('documents').select('id, title, description, storage_path').eq('published', true).order('created_at'),
  ]);
  const page = (slug: string) => pages?.find((p) => p.slug === slug);
  const publicUrl = (path: string) => sb.storage.from('documents').getPublicUrl(path).data.publicUrl;

  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Link href="/" className="brand"><img src="/ceda-logo.png" alt="CEDA" width={67} height={40} /><span>Innovation Portal</span></Link>
          <nav className="nav"><Link href="/app">My dashboard</Link></nav>
        </div>
      </header>
      <main id="main">
        <div className="wrap stack" style={{ maxWidth: 820 }}>
          <h1>How can we help you today?</h1>
          {page('about') && <p className="muted">{page('about')!.body}</p>}

          <FaqSearch faqs={faqs ?? []} />

          {!!docs?.length && (
            <section className="card">
              <h2>Templates and guides</h2>
              <ul>
                {docs.map((d) => (
                  <li key={d.id}>
                    <a href={publicUrl(d.storage_path)} rel="noopener">{d.title}</a>
                    {d.description && <span className="muted"> · {d.description}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2>Regulatory contacts</h2>
            <p className="muted">The authorities you may need while turning your idea into a business.</p>
            <div className="authorities">
              {authorities?.map((a) => {
                const logo = logoFor(a.name);
                return (
                  <article key={a.id} className="authority">
                    <div className="authority-logo">
                      {logo ? <img src={logo} alt={`${a.name} logo`} loading="lazy" decoding="async" /> : <span aria-hidden="true">{initials(a.name)}</span>}
                    </div>
                    <h3>{a.name}</h3>
                    {a.remit && <p className="muted">{a.remit}</p>}
                    <div className="authority-links">
                      {a.website && <a href={a.website} rel="noopener noreferrer" target="_blank">Visit website</a>}
                      {a.phone && <a href={`tel:${a.phone.replace(/[^0-9+]/g, '')}`}>{a.phone}</a>}
                      {a.email && <a href={`mailto:${a.email}`}>{a.email}</a>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {['privacy', 'support'].map((s) =>
            page(s) ? (
              <section key={s} id={s} className="card">
                <h2>{page(s)!.title}</h2>
                <p style={{ whiteSpace: 'pre-line' }}>{page(s)!.body}</p>
              </section>
            ) : null,
          )}
        </div>
      </main>
    </>
  );
}
