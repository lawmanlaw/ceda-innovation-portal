import type { Metadata, Viewport } from 'next';
import '@fontsource/saira/400.css';
import '@fontsource/saira/600.css';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: { default: 'CEDA Innovation Portal', template: '%s · CEDA Innovation Portal' },
  description: 'Submit ideas to CEDA, follow their evaluation and get recognised.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip">Skip to content</a>
        {children}
        <footer className="wrap muted" style={{ padding: '1.5rem 0 2rem', fontSize: '.85rem' }}>
          Prototype built by Neoterra for the CEDA Innovation Portal Hackathon, 2026 · <Link href="/help#privacy">Privacy</Link> · <Link href="/help#support">Support</Link>
        </footer>
      </body>
    </html>
  );
}
