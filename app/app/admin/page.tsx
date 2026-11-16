import Link from 'next/link';
import { requireMe, supabaseServer } from '@/lib/supabase/server';
import LinkKey from '@/components/link-key';
import ActionForm from '@/components/action-form';
import { ROLE_LABEL, type FormField, type Role } from '@/lib/types';
import { fmtDate } from '@/lib/util';
import { addDocument, addHoliday, deleteRow, saveAuthority, saveCriterion, saveFaq, saveField, savePage, setRole } from './actions';

export const metadata = { title: 'Settings' };

const TABS = [
  ['users', 'People and roles'], ['criteria', 'Evaluation criteria'], ['form', 'Application form'], ['documents', 'Templates'],
  ['faqs', 'FAQs'], ['authorities', 'Regulatory contacts'], ['pages', 'Pages'], ['holidays', 'Chat holidays'],
] as const;

const Check = ({ name, label, on }: { name: string; label: string; on: boolean }) => (
  <label className="row" style={{ fontWeight: 400, margin: 0 }}><input type="checkbox" name={name} defaultChecked={on} /> {label}</label>
);

const Remove = ({ table, id }: { table: string; id: string }) => (
  <form action={deleteRow}>
    <input type="hidden" name="table" value={table} />
    <input type="hidden" name="id" value={id} />
    <button className="btn danger small">Delete</button>
  </form>
);

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  await requireMe('admin');
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : 'users';
  const sb = await supabaseServer();

  let body: React.ReactNode = null;

  if (tab === 'users') {
    let q = sb.from('profiles').select('id, full_name, email, role, organisation, created_at').order('created_at', { ascending: false }).limit(100);
    if (sp.q) q = q.ilike('email', `%${sp.q.slice(0, 80).replace(/[%_\\]/g, '')}%`);
    const { data } = await q;
    body = (
      <>
        <form className="row" role="search">
          <input type="hidden" name="tab" value="users" />
          <input name="q" placeholder="Search by email" defaultValue={sp.q} aria-label="Search by email" style={{ flex: 1 }} />
          <button className="btn secondary">Search</button>
        </form>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Name</th><th>Joined</th><th>Role</th></tr></thead>
            <tbody>
              {data?.map((u) => (
                <tr key={u.id}>
                  <td>{u.full_name || 'No name'}<br /><small>{u.email}{u.organisation ? ` · ${u.organisation}` : ''}</small></td>
                  <td>{fmtDate(u.created_at)}</td>
                  <td>
                    <ActionForm action={setRole} submit="Save" className="row">
                      <input type="hidden" name="id" value={u.id} />
                      <select name="role" defaultValue={u.role} aria-label={`Role for ${u.email}`} style={{ width: 'auto' }}>
                        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  if (tab === 'criteria') {
    const { data } = await sb.from('criteria').select('*').order('sort');
    const Form = ({ c }: { c?: { id: string; name: string; description: string | null; weight: number; max_score: number; sort: number; active: boolean } }) => (
      <ActionForm action={saveCriterion} submit={c ? 'Save' : 'Add criterion'}>
        {c && <input type="hidden" name="id" value={c.id} />}
        <div className="grid" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
          <input name="name" defaultValue={c?.name} placeholder="Name" aria-label="Name" required />
          <input name="weight" type="number" step="0.5" min="0.5" defaultValue={c?.weight ?? 1} aria-label="Weight" title="Weight" />
          <input name="max_score" type="number" min="1" max="100" defaultValue={c?.max_score ?? 10} aria-label="Maximum score" title="Maximum score" />
          <input name="sort" type="number" defaultValue={c?.sort ?? 100} aria-label="Order" title="Order" />
        </div>
        <input name="description" defaultValue={c?.description ?? ''} placeholder="What evaluators should look for" aria-label="Description" />
        <Check name="active" label="In use" on={c?.active ?? true} />
      </ActionForm>
    );
    body = (
      <>
        <p className="muted">Changes apply to ideas scored from now on. Retire a criterion instead of deleting it so past scores stay readable. Columns: name, weight, maximum score, order.</p>
        {data?.map((c) => <div key={c.id} style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--line)' }}><Form c={c} /></div>)}
        <h3>New criterion</h3>
        <Form />
      </>
    );
  }

  if (tab === 'form') {
    const { data } = await sb.from('form_fields').select('*').order('sort');
    const Form = ({ f }: { f?: FormField }) => (
      <ActionForm action={saveField} submit={f ? 'Save' : 'Add question'}>
        {f && <input type="hidden" name="id" value={f.id} />}
        <div className="grid" style={{ gridTemplateColumns: '1fr 2fr 1fr' }}>
          <input name="key" defaultValue={f?.key} placeholder="key_name" aria-label="Key" required readOnly={!!f} />
          <input name="label" defaultValue={f?.label} placeholder="Question" aria-label="Question" required />
          <select name="kind" defaultValue={f?.kind ?? 'textarea'} aria-label="Answer type">
            <option value="textarea">Long text</option><option value="text">Short text</option>
            <option value="select">Choice</option><option value="number">Number</option><option value="url">Link</option>
          </select>
        </div>
        <input name="help" defaultValue={f?.help ?? ''} placeholder="Help text (optional)" aria-label="Help text" />
        <textarea name="options" defaultValue={(f?.options ?? []).join('\n')} placeholder="Choices, one per line (for Choice questions)" aria-label="Choices" style={{ minHeight: 60 }} />
        <div className="row">
          <input name="max_length" type="number" defaultValue={f?.max_length ?? 2000} aria-label="Maximum length" title="Maximum length" style={{ width: 120 }} />
          <input name="sort" type="number" defaultValue={f?.sort ?? 100} aria-label="Order" title="Order" style={{ width: 100 }} />
          <Check name="required" label="Required" on={f?.required ?? true} />
          <Check name="active" label="Shown on the form" on={f?.active ?? true} />
        </div>
      </ActionForm>
    );
    body = (
      <>
        <p className="muted">These questions appear on the submission form after title, summary, category and district.</p>
        {(data as FormField[] | null)?.map((f) => <div key={f.id} style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--line)' }}><Form f={f} /></div>)}
        <h3>New question</h3>
        <Form />
      </>
    );
  }

  if (tab === 'documents') {
    const { data } = await sb.from('documents').select('*').order('created_at', { ascending: false });
    body = (
      <>
        <p className="muted">Templates and guides listed on the Help page for everyone to download.</p>
        <table><tbody>{data?.map((d) => <tr key={d.id}><td>{d.title}<br /><small>{d.description}</small></td><td><Remove table="documents" id={d.id} /></td></tr>)}</tbody></table>
        <h3>Upload</h3>
        <ActionForm action={addDocument} submit="Upload" reset>
          <input name="title" placeholder="Title" aria-label="Title" required />
          <input name="description" placeholder="Short description (optional)" aria-label="Description" />
          <input name="file" type="file" accept=".pdf,.docx,.xlsx,.pptx" required aria-label="File" />
        </ActionForm>
      </>
    );
  }

  if (tab === 'faqs') {
    const { data } = await sb.from('faqs').select('*').order('sort');
    const Form = ({ q }: { q?: { id: string; question: string; answer: string; topic: string; sort: number; published: boolean } }) => (
      <ActionForm action={saveFaq} submit={q ? 'Save' : 'Add FAQ'} extra={q && <Remove table="faqs" id={q.id} />}>
        {q && <input type="hidden" name="id" value={q.id} />}
        <div className="grid" style={{ gridTemplateColumns: '3fr 1fr 80px' }}>
          <input name="question" defaultValue={q?.question} placeholder="Question" aria-label="Question" required />
          <input name="topic" defaultValue={q?.topic ?? 'General'} aria-label="Topic" title="Topic" />
          <input name="sort" type="number" defaultValue={q?.sort ?? 100} aria-label="Order" title="Order" />
        </div>
        <textarea name="answer" defaultValue={q?.answer} placeholder="Answer" aria-label="Answer" required style={{ minHeight: 70 }} />
        <Check name="published" label="Published" on={q?.published ?? true} />
      </ActionForm>
    );
    body = <>{data?.map((q) => <div key={q.id} style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--line)' }}><Form q={q} /></div>)}<h3>New FAQ</h3><Form /></>;
  }

  if (tab === 'authorities') {
    const { data } = await sb.from('authorities').select('*').order('sort');
    const Form = ({ a }: { a?: { id: string; name: string; remit: string | null; phone: string | null; email: string | null; website: string | null; sort: number } }) => (
      <ActionForm action={saveAuthority} submit={a ? 'Save' : 'Add contact'} extra={a && <Remove table="authorities" id={a.id} />}>
        {a && <input type="hidden" name="id" value={a.id} />}
        <div className="grid" style={{ gridTemplateColumns: '2fr 2fr' }}>
          <input name="name" defaultValue={a?.name} placeholder="Authority" aria-label="Authority" required />
          <input name="remit" defaultValue={a?.remit ?? ''} placeholder="What they handle" aria-label="What they handle" />
          <input name="phone" defaultValue={a?.phone ?? ''} placeholder="Phone" aria-label="Phone" />
          <input name="email" type="email" defaultValue={a?.email ?? ''} placeholder="Email" aria-label="Email" />
          <input name="website" defaultValue={a?.website ?? ''} placeholder="https://" aria-label="Website" />
          <input name="sort" type="number" defaultValue={a?.sort ?? 100} aria-label="Order" title="Order" />
        </div>
      </ActionForm>
    );
    body = <>{data?.map((a) => <div key={a.id} style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--line)' }}><Form a={a} /></div>)}<h3>New contact</h3><Form /></>;
  }

  if (tab === 'pages') {
    const { data } = await sb.from('pages').select('*').order('slug');
    body = data?.map((p) => (
      <div key={p.slug} style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--line)' }}>
        <ActionForm action={savePage} submit="Save">
          <input type="hidden" name="slug" value={p.slug} />
          <input name="title" defaultValue={p.title} aria-label="Title" required />
          <textarea name="body" defaultValue={p.body} aria-label="Text" style={{ minHeight: 140 }} />
          <small>Last changed {fmtDate(p.updated_at, true)}</small>
        </ActionForm>
      </div>
    ));
  }

  if (tab === 'holidays') {
    const { data } = await sb.from('public_holidays').select('*').order('day');
    body = (
      <>
        <p className="muted">Live chat shows the after-hours message on these days.</p>
        <table><tbody>{data?.map((h) => <tr key={h.day}><td>{fmtDate(h.day)}</td><td>{h.name}</td><td><Remove table="public_holidays" id={h.day} /></td></tr>)}</tbody></table>
        <h3>Add a holiday</h3>
        <ActionForm action={addHoliday} submit="Add" reset className="row">
          <input name="day" type="date" required aria-label="Date" style={{ width: 'auto' }} />
          <input name="name" placeholder="Name" required aria-label="Name" style={{ flex: 1 }} />
        </ActionForm>
      </>
    );
  }

  return (
    <div className="stack">
      <h1>Settings</h1>
      <LinkKey linked={Boolean((await (await supabaseServer()).rpc('server_key_linked')).data)} />
      <nav className="nav" aria-label="Settings sections">
        {TABS.map(([k, label]) => <Link key={k} href={`/app/admin?tab=${k}`} aria-current={k === tab ? 'page' : undefined}>{label}</Link>)}
      </nav>
      <section className="card stack">{body}</section>
    </div>
  );
}
