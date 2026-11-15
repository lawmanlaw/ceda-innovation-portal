'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavLinks({ links }: { links: [string, string][] }) {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {links.map(([href, label]) => (
        <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
