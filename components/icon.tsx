// Small line icons that draw themselves in once when they appear
export type IconName = 'bulb' | 'send' | 'review' | 'chat' | 'check' | 'award' | 'home' | 'list' | 'chart' | 'settings' | 'plus' | 'user' | 'headset' | 'help';

const P = (d: string, cls = '') => <path d={d} pathLength={1} className={`draw ${cls}`} />;

const PATHS: Record<IconName, React.ReactNode> = {
  bulb: <>{P('M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z')}{P('M9.5 19h5M10.5 21.5h3', 'd2')}<path className="rays" d="M12 .5v1M4 3.5l.8.8M20 3.5l-.8.8M1.5 10h1M21.5 10h1" /></>,
  send: <>{P('M21 3l-7 18-4-7-7-4 18-7z')}{P('M21 3 10 14', 'd2')}</>,
  review: <>{P('M7 5H5v16h14V5h-2M9 3.5h6v3H9z')}{P('M9 14l2 2 4-4', 'd2')}</>,
  chat: <>{P('M4 5h16v11H9l-5 4z')}{P('M8 9h8M8 12h5', 'd2')}</>,
  check: <>{P('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z')}{P('M8 12l3 3 5-6', 'd2')}</>,
  home: P('M3 11l9-7 9 7v9h-6v-6H9v6H3z'),
  list: P('M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01'),
  chart: P('M4 20V11M10 20V4M16 20v-7M2 20h20'),
  settings: P('M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4'),
  plus: P('M12 5v14M5 12h14'),
  user: P('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0'),
  headset: P('M4 15v-3a8 8 0 0 1 16 0v3M4 14h3v5H4zM17 14h3v5h-3zM20 19c0 2-2 3-4 3h-3'),
  help: <>{P('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z')}{P('M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4M12 16.5h.01', 'd2')}</>,
  award: <>{P('M12 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z')}{P('M9 14 7.5 21l4.5-2.5 4.5 2.5L15 14', 'd2')}</>,
};

export default function Icon({ name, className = '', still = false }: { name: IconName; className?: string; still?: boolean }) {
  return <svg className={`icon ${still ? 'still' : ''} ${className}`} viewBox="0 0 24 24" aria-hidden="true">{PATHS[name]}</svg>;
}
