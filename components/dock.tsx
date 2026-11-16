'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/icon';
import type { Role } from '@/lib/types';

type Item = [href: string, label: string, icon: Parameters<typeof Icon>[0]['name'], fab?: boolean];

const DOCK: Record<Role, Item[]> = {
  submitter: [['/app', 'My ideas', 'home'], ['/help', 'Help', 'help'], ['/app/ideas/new', 'Submit', 'plus', true], ['/app/chat', 'Chat', 'chat'], ['/app/profile', 'Profile', 'user']],
  evaluator: [['/app', 'To evaluate', 'home'], ['/help', 'Help', 'help'], ['/app/profile', 'Profile', 'user']],
  adjudicator: [['/app', 'Overview', 'home'], ['/app/ideas', 'Ideas', 'list'], ['/app/reports', 'Reports', 'chart'], ['/app/profile', 'Profile', 'user']],
  admin: [['/app', 'Overview', 'home'], ['/app/ideas', 'Ideas', 'list'], ['/app/reports', 'Reports', 'chart'], ['/app/admin', 'Settings', 'settings'], ['/app/profile', 'Profile', 'user']],
  agent: [['/app/agent', 'Live chat', 'headset'], ['/help', 'Help', 'help'], ['/app/profile', 'Profile', 'user']],
  observer: [['/app/ideas', 'Ideas', 'list'], ['/help', 'Help', 'help'], ['/app/profile', 'Profile', 'user']],
};

// Floating bottom bar for phones; the top navigation takes over on wider screens
export default function Dock({ role }: { role: Role }) {
  const path = usePathname();
  return (
    <nav className="dock" aria-label="Quick navigation">
      {DOCK[role].map(([href, label, icon, fab]) => (
        <Link key={href} href={href} className={fab ? 'fab' : ''} aria-current={path === href ? 'page' : undefined}>
          <Icon name={icon} still />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
