'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon, { type IconName } from '@/components/icon';
import Bokamoso from '@/components/bokamoso';

const ICONS: Record<string, IconName> = {
  '/app': 'home', '/app/challenges': 'bulb', '/app/ideas/new': 'plus', '/app/chat': 'chat', '/app/ideas': 'list',
  '/app/reports': 'chart', '/app/agent': 'headset', '/app/moderation': 'check', '/app/admin': 'settings', '/app/audit': 'review', '/help': 'help',
};

export default function Sidebar({ links, helpHref }: { links: [string, string][]; helpHref: string }) {
  const path = usePathname();
  return (
    <aside className="sidebar" aria-label="Main">
      <nav>
        {links.map(([href, label]) => (
          <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}>
            <Icon name={ICONS[href] ?? 'list'} still /><span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="side-help">
        <Bokamoso mode="wave" size={84} />
        <strong>Need a hand?</strong>
        <span>I&apos;m Bokamoso. Ask a CEDA consultant anything.</span>
        <Link href={helpHref} className="btn small">Get help ›</Link>
      </div>
    </aside>
  );
}
