import Link from 'next/link';

export default function PublicHeader() {
  return (
    <header className="topbar">
      <div className="wrap">
        <Link href="/" className="brand"><span className="brand-mark"><img src="/ceda-logo.png" alt="CEDA" width={67} height={40} /></span><i className="brand-rule" aria-hidden="true" /><span className="brand-name"><span>Innovation Portal</span></span></Link>
        <nav className="nav"><Link href="/challenges">Challenges</Link><Link href="/report">Report a problem</Link><Link href="/app">My dashboard</Link></nav>
      </div>
    </header>
  );
}
