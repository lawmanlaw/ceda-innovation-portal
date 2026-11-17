'use client';
import { useEffect } from 'react';

// Top-bar menus (alerts, account): only one open at a time, and they close on an outside click or Esc.
export default function MenuCloser() {
  useEffect(() => {
    const open = () => [...document.querySelectorAll<HTMLDetailsElement>('.topbar details[open]')];
    const down = (e: PointerEvent) => open().forEach((d) => { if (!d.contains(e.target as Node)) d.open = false; });
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') open().forEach((d) => { d.open = false; d.querySelector('summary')?.focus(); }); };
    const toggle = (e: Event) => {
      const t = e.target as HTMLDetailsElement;
      if (t.matches?.('.topbar details') && t.open) open().forEach((d) => { if (d !== t) d.open = false; });
    };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    document.addEventListener('toggle', toggle, true);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); document.removeEventListener('toggle', toggle, true); };
  }, []);
  return null;
}
