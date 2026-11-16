'use client';
import { useMemo, useState } from 'react';

type Faq = { id: string; question: string; answer: string; topic: string };

export default function FaqSearch({ faqs }: { faqs: Faq[] }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return faqs;
    const words = s.split(/\s+/).filter((w) => w.length > 2);
    return faqs.filter((f) => {
      const t = (f.question + ' ' + f.answer).toLowerCase();
      return t.includes(s) || words.some((w) => t.includes(w));
    });
  }, [q, faqs]);
  const topics = [...new Set(shown.map((f) => f.topic))];
  return (
    <>
      <input type="search" className="help-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search help, for example: files" aria-label="Search help" />
      {q.trim().length >= 2 && !shown.length && <p className="muted">Nothing matches that. Try another word, or use the help button to talk to a consultant.</p>}
      {topics.map((t) => (
        <section key={t} className="card">
          <h2>{t}</h2>
          {shown.filter((f) => f.topic === t).map((f) => (
            <details key={f.id} style={{ padding: '.5rem 0' }} open={q.trim().length >= 2}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{f.question}</summary>
              <p style={{ marginTop: '.5rem' }}>{f.answer}</p>
            </details>
          ))}
        </section>
      ))}
    </>
  );
}
