import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';

export const metadata = { title: 'Help' };
export const revalidate = 300;

export default async function Help() {
  const sb = await supabaseServer();
  const [{ data: faqs }, { data: authorities }, { data: pages }, { data: docs }] = await Promise.all([
    sb.from('faqs').select('id, question, answer, topic').eq('published', true).order('sort'),
    sb.from('authorities').select('id, name, remit, phone, email, website').order('sort'),
    sb.from('pages').select('slug, title, body').in('slug', ['about', 'privacy', 'support', 'hosting']),
    sb.from('documents').select('id, title, description, storage_path').eq('published', true).order('created_at'),
  ]);
  const page = (slug: string) => pages?.find((p) => p.slug === slug);
  const topics = [...new Set((faqs ?? []).map((f) => f.topic))];
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
          <h1>Help</h1>
          {page('about') && <p className="muted">{page('about')!.body}</p>}

          {topics.map((t) => (
            <section key={t} className="card">
              <h2>{t}</h2>
              {faqs!.filter((f) => f.topic === t).map((f) => (
                <details key={f.id} style={{ padding: '.5rem 0' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{f.question}</summary>
                  <p style={{ marginTop: '.5rem' }}>{f.answer}</p>
                </details>
              ))}
            </section>
          ))}

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

          <section className="card">
            <h2>Regulatory contacts</h2>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Authority</th><th>Handles</th><th>Contact</th></tr></thead>
                <tbody>
                  {authorities?.map((a) => (
                    <tr key={a.id}>
                      <td>{a.name}</td>
                      <td>{a.remit}</td>
                      <td>
                        {a.website && <a href={a.website} rel="noopener noreferrer" target="_blank">Website</a>}
                        {a.phone && <div>{a.phone}</div>}
                        {a.email && <div><a href={`mailto:${a.email}`}>{a.email}</a></div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {['privacy', 'support', 'hosting'].map((s) =>
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
