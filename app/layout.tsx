import EyeTracker from '@/components/eye-tracker';
import type { Metadata, Viewport } from 'next';
import '@fontsource/saira/400.css';
import '@fontsource/saira/600.css';
import './globals.css';
import Link from 'next/link';
import ChatWidget from '@/components/chat-widget';
import Safe from '@/components/safe';
import { getMe } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: { default: 'CEDA Innovation Portal', template: '%s · CEDA Innovation Portal' },
  description: 'Submit ideas to CEDA, follow their evaluation and get recognised.',
  applicationName: 'CEDA Innovation Portal',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#7a1e1e' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip">Skip to content</a>
        {children}
        <EyeTracker />
        <Safe label="Live chat"><ChatWidget userId={me?.id ?? null} hide={me?.role === 'agent'} /></Safe>
        <footer className="wrap muted" style={{ padding: '1.5rem 0 2rem', fontSize: '.85rem' }}>
          <Link href="/help#privacy">Privacy</Link> · <Link href="/help#support">Support</Link>
        </footer>
      </body>
    </html>
  );
}
