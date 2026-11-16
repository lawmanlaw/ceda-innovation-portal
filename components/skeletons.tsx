// Loading placeholders. Each one mirrors the layout of the page it stands in for,
// so nothing jumps when the real content arrives.
const Sk = ({ w = '100%', h }: { w?: string | number; h?: number }) => <div className="sk" style={{ width: w, height: h }} />;
const Wrap = ({ children }: { children: React.ReactNode }) => <div className="stack" role="status" aria-label="Loading">{children}</div>;
const Head = ({ button = false }: { button?: boolean }) => (
  <div className="row between"><Sk w="38%" h={34} />{button && <Sk w={150} h={44} />}</div>
);
const Lines = ({ n = 3 }: { n?: number }) => <>{Array.from({ length: n }, (_, i) => <Sk key={i} w={i === n - 1 ? '60%' : '100%'} />)}</>;
const Track = () => <div className="track">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="sk" style={{ height: 6, margin: 0 }} />)}</div>;
const Field = ({ tall = false }: { tall?: boolean }) => <div className="field"><Sk w="30%" /><Sk h={tall ? 120 : 44} /></div>;

// My ideas: title with button, then one card per idea with its progress bar
export function DashboardSk() {
  return (
    <Wrap>
      <Head button />
      {[0, 1, 2].map((i) => (
        <div key={i} className="card">
          <div className="row between"><Sk w="45%" h={22} /><Sk w={90} /></div>
          <Sk w="35%" />
          <Track />
        </div>
      ))}
    </Wrap>
  );
}

// Lists: filter bar, then table rows
export function TableSk({ filter = true, rows = 8 }: { filter?: boolean; rows?: number }) {
  return (
    <Wrap>
      <Head />
      {filter && <div className="card row"><Sk w="45%" h={44} /><Sk w="20%" h={44} /><Sk w="20%" h={44} /></div>}
      <div className="card">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="row" style={{ padding: '.7rem 0', flexWrap: 'nowrap' }}>
            <Sk w="40%" /><Sk w="15%" /><Sk w="15%" /><Sk w="15%" />
          </div>
        ))}
      </div>
    </Wrap>
  );
}

// One idea: heading, progress bar, main column and side column
export function DetailSk() {
  return (
    <Wrap>
      <Sk w={50} />
      <div className="row between"><div style={{ width: '55%' }}><Sk h={34} /><Sk w="60%" /></div><Sk w={100} /></div>
      <Track />
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', alignItems: 'start' }}>
        <div className="stack">
          <div className="card"><Sk w="25%" h={22} /><Lines n={4} /><Sk w="30%" h={18} /><Lines n={3} /></div>
          <div className="card"><Sk w="35%" h={22} /><Lines n={2} /></div>
          <div className="card"><Sk w="30%" h={22} /><Lines n={3} /><Sk h={90} /></div>
        </div>
        <div className="stack">
          <div className="card"><Sk w="40%" h={22} /><Lines n={4} /></div>
        </div>
      </div>
    </Wrap>
  );
}

// Forms: submit an idea, edit, profile, chat
export function FormSk({ fields = 5 }: { fields?: number }) {
  return (
    <div style={{ maxWidth: 760 }}>
      <Wrap>
        <Head />
        <div className="card">
          {Array.from({ length: fields }, (_, i) => <Field key={i} tall={i > 1} />)}
          <div style={{ marginTop: '1.1rem' }}><Sk w={160} h={44} /></div>
        </div>
      </Wrap>
    </div>
  );
}

// Reports: four stat tiles, then chart cards
export function ReportsSk() {
  return (
    <Wrap>
      <Head button />
      <div className="grid cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="card"><Sk w="40%" h={30} /><Sk w="70%" /></div>)}</div>
      <div className="grid cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card"><Sk w="45%" h={22} />{[90, 65, 40, 25].map((w) => <Sk key={w} w={`${w}%`} h={10} />)}</div>
        ))}
      </div>
    </Wrap>
  );
}

// Live chat console: queue on the left, conversation on the right
export function SplitSk() {
  return (
    <Wrap>
      <Head />
      <div className="grid" style={{ gridTemplateColumns: 'minmax(240px, 1fr) minmax(0, 2fr)', alignItems: 'start' }}>
        <div className="stack"><div className="card"><Sk w="50%" h={22} /><Lines n={3} /></div><div className="card"><Sk w="50%" h={22} /><Lines n={2} /></div></div>
        <div className="card"><Sk w="35%" h={22} /><Sk w="55%" h={38} /><Sk w="45%" h={38} /><Sk h={44} /></div>
      </div>
    </Wrap>
  );
}

// Settings: section tabs, then a card of rows
export function SettingsSk() {
  return (
    <Wrap>
      <Head />
      <div className="row">{[110, 140, 120, 90, 60].map((w) => <Sk key={w} w={w} h={30} />)}</div>
      <div className="card">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="row between" style={{ padding: '.7rem 0', flexWrap: 'nowrap' }}><Sk w="45%" /><Sk w={160} h={44} /></div>)}</div>
    </Wrap>
  );
}
