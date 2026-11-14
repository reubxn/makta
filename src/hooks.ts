import { useEffect, useRef, useState } from 'react';

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Tween a number towards its target over `ms` milliseconds. */
export function useTween(target: number, ms = 800): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const current = useRef(target);
  useEffect(() => {
    from.current = current.current;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const v = from.current + (target - from.current) * easeInOut(t);
      current.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

const nf0 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export function fmt(v: number, digits = 0): string {
  if (!Number.isFinite(v)) return '–';
  return digits === 0 ? nf0.format(Math.round(v)) : nf1.format(v);
}

/** Round large counts for display ("about"): 3 significant figures. */
export function fmtRounded(v: number): string {
  if (!Number.isFinite(v)) return '–';
  if (Math.abs(v) < 1000) return nf0.format(Math.round(v));
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - 2);
  return nf0.format(Math.round(v / mag) * mag);
}

export function fmtHours(h: number): string {
  if (!Number.isFinite(h)) return '–';
  return h < 10 ? nf1.format(h) : nf0.format(Math.round(h));
}
