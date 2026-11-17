'use client';
import { useEffect } from 'react';

// Makes every Bokamoso on the page look at the mouse pointer. Touch screens get a gentle
// drift from CSS instead; reduced motion keeps his eyes still.
export default function EyeTracker() {
  useEffect(() => {
    if (matchMedia('(hover: none)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    const run = () => {
      raf = 0;
      document.querySelectorAll<SVGSVGElement>('svg.bk').forEach((svg) => {
        const eyes = svg.querySelector('.bk-eyes');
        if (!eyes) return;
        const r = eyes.getBoundingClientRect();
        if (!r.width) return;
        const dx = x - (r.left + r.width / 2);
        const dy = y - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / 200);
        svg.style.setProperty('--ex', `${((dx / d) * 4 * k).toFixed(2)}px`);
        svg.style.setProperty('--ey', `${((dy / d) * 3 * k).toFixed(2)}px`);
      });
    };
    const on = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(run);
    };
    window.addEventListener('pointermove', on, { passive: true });
    return () => { window.removeEventListener('pointermove', on); cancelAnimationFrame(raf); };
  }, []);
  return null;
}
