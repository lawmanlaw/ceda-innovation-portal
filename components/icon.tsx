// Small line icons that draw themselves in once when they appear
type Name = 'bulb' | 'send' | 'review' | 'chat' | 'check' | 'award';

const P = (d: string, cls = '') => <path d={d} pathLength={1} className={`draw ${cls}`} />;

const PATHS: Record<Name, React.ReactNode> = {
  bulb: <>{P('M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z')}{P('M9.5 19h5M10.5 21.5h3', 'd2')}<path className="rays" d="M12 .5v1M4 3.5l.8.8M20 3.5l-.8.8M1.5 10h1M21.5 10h1" /></>,
  send: <>{P('M21 3l-7 18-4-7-7-4 18-7z')}{P('M21 3 10 14', 'd2')}</>,
  review: <>{P('M7 5H5v16h14V5h-2M9 3.5h6v3H9z')}{P('M9 14l2 2 4-4', 'd2')}</>,
  chat: <>{P('M4 5h16v11H9l-5 4z')}{P('M8 9h8M8 12h5', 'd2')}</>,
  check: <>{P('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z')}{P('M8 12l3 3 5-6', 'd2')}</>,
  award: <>{P('M12 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z')}{P('M9 14 7.5 21l4.5-2.5 4.5 2.5L15 14', 'd2')}</>,
};

export default function Icon({ name, className = '' }: { name: Name; className?: string }) {
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" aria-hidden="true">{PATHS[name]}</svg>;
}
