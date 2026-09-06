import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/ui/hooks/useReducedMotion';

interface Flake {
  x: number;
  y: number;
  r: number;
  vy: number;
  drift: number;
  phase: number;
  alpha: number;
}

/**
 * Atmosphere, not information. Canvas rather than DOM nodes so it costs one
 * composited layer instead of a hundred, and it switches itself off entirely
 * for reduced-motion and when the tab is hidden.
 */
export function Snowfall({ density = 42 }: { density?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reduced) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 0;
    let height = 0;
    let flakes: Flake[] = [];
    let frame = 0;
    let last = performance.now();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      flakes = Array.from({ length: density }, () => spawn(width, height, true));
    };

    const spawn = (w: number, h: number, anywhere: boolean): Flake => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : -8,
      r: 0.6 + Math.random() * 1.7,
      vy: 8 + Math.random() * 20,
      drift: 4 + Math.random() * 14,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.16 + Math.random() * 0.4,
    });

    const tick = (time: number) => {
      const dt = Math.min(0.05, (time - last) / 1000);
      last = time;
      context.clearRect(0, 0, width, height);
      for (const flake of flakes) {
        flake.y += flake.vy * dt;
        flake.phase += dt * 0.9;
        const x = flake.x + Math.sin(flake.phase) * flake.drift;
        if (flake.y > height + 6) Object.assign(flake, spawn(width, height, false));
        context.globalAlpha = flake.alpha;
        context.fillStyle = '#dff3ff';
        context.beginPath();
        context.arc(x, flake.y, flake.r, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      frame = requestAnimationFrame(tick);
    };

    resize();
    frame = requestAnimationFrame(tick);
    window.addEventListener('resize', resize);

    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [density, reduced]);

  if (reduced) return null;
  return <canvas ref={canvasRef} className="snowfall" aria-hidden="true" />;
}
