'use client';
import { useEffect, useRef, useState } from 'react';

// Counts up from zero when it scrolls into view. Shows the final number straight away for reduced motion.
export default function CountUp({ value, pad = true }: { value: number; pad?: boolean }) {
  const [n, setN] = useState(value);
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !el.current) return;
    setN(0);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / 900);
        setN(Math.round(value * (1 - (1 - p) ** 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    io.observe(el.current);
    return () => io.disconnect();
  }, [value]);
  return <span ref={el}>{pad && value < 10 ? String(n).padStart(2, '0') : n}</span>;
}
