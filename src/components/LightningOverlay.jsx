import React, { useEffect, useRef, useState } from 'react';

export default function LightningOverlay({ enabled = true }) {
  const canvasRef = useRef(null);
  const [flashOpacity, setFlashOpacity] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animId = null;
    let strikeTimeout = null;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Subtle rising golden embers / Tengri sky sparkles
    const embers = Array.from({ length: 34 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 0.8 + Math.random() * 1.9,
      vy: -(0.18 + Math.random() * 0.35),
      vx: (Math.random() - 0.5) * 0.25,
      alpha: 0.2 + Math.random() * 0.55,
      gold: Math.random() > 0.35,
    }));

    // Active lightning bolts
    let bolts = [];

    function buildBolt(startX, startY, endY, displace, depth = 0) {
      const segments = [];
      const steps = depth === 0 ? 18 : 9;
      let curX = startX;
      let curY = startY;
      const dy = (endY - startY) / steps;

      for (let i = 0; i < steps; i++) {
        const nextY = curY + dy;
        const jitter = (Math.random() - 0.5) * displace;
        const nextX = curX + jitter;
        segments.push({ x1: curX, y1: curY, x2: nextX, y2: nextY });

        // Occasional fork branch
        if (depth < 2 && i > 2 && i < steps - 3 && Math.random() < (depth === 0 ? 0.32 : 0.2)) {
          const branchLen = (endY - nextY) * (0.35 + Math.random() * 0.3);
          const branchSegs = buildBolt(nextX, nextY, nextY + branchLen, displace * 0.65, depth + 1);
          segments.push(...branchSegs.map((s) => ({ ...s, branch: true })));
        }
        curX = nextX;
        curY = nextY;
      }
      return segments;
    }

    function triggerStrike(isDouble = true) {
      const startX = width * (0.14 + Math.random() * 0.72);
      const endY = height * (0.42 + Math.random() * 0.26);
      const segs = buildBolt(startX, -10, endY, Math.min(width * 0.06, 65), 0);

      bolts.push({
        segments: segs,
        alpha: 1,
        hue: Math.random() > 0.3 ? 'turquoise' : 'gold',
      });

      setFlashOpacity(0.24);
      setTimeout(() => setFlashOpacity(0.06), 75);
      setTimeout(() => setFlashOpacity(0), 190);

      if (isDouble && Math.random() < 0.6) {
        setTimeout(() => {
          bolts.push({
            segments: segs,
            alpha: 0.85,
            hue: 'turquoise',
          });
          setFlashOpacity(0.18);
          setTimeout(() => setFlashOpacity(0), 150);
        }, 140);
      }
    }

    function scheduleNextStrike(initialDelay = null) {
      const delay = initialDelay ?? 3800 + Math.random() * 4800;
      strikeTimeout = setTimeout(() => {
        triggerStrike(true);
        scheduleNextStrike();
      }, delay);
    }

    // Trigger first dramatic strike shortly after landing so user sees it right away
    scheduleNextStrike(1100);

    function render() {
      ctx.clearRect(0, 0, width, height);

      // Render drifting embers
      for (const e of embers) {
        e.x += e.vx;
        e.y += e.vy;
        if (e.y < -10) {
          e.y = height + 10;
          e.x = Math.random() * width;
        }
        if (e.x < 0) e.x = width;
        if (e.x > width) e.x = 0;

        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fillStyle = e.gold
          ? `rgba(255, 217, 130, ${e.alpha})`
          : `rgba(94, 234, 212, ${e.alpha * 0.85})`;
        ctx.fill();
      }

      // Render fading lightning bolts
      bolts = bolts.filter((b) => b.alpha > 0.02);
      for (const b of bolts) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const glowColor =
          b.hue === 'gold'
            ? `rgba(255, 215, 120, ${b.alpha})`
            : `rgba(94, 234, 212, ${b.alpha})`;

        // Outer electric bloom
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 22;
        ctx.strokeStyle = glowColor;
        for (const s of b.segments) {
          ctx.lineWidth = s.branch ? 1.4 : 3.2;
          ctx.beginPath();
          ctx.moveTo(s.x1, s.y1);
          ctx.lineTo(s.x2, s.y2);
          ctx.stroke();
        }

        // Bright white core
        ctx.shadowBlur = 6;
        ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, b.alpha * 1.15)})`;
        for (const s of b.segments) {
          ctx.lineWidth = s.branch ? 0.7 : 1.5;
          ctx.beginPath();
          ctx.moveTo(s.x1, s.y1);
          ctx.lineTo(s.x2, s.y2);
          ctx.stroke();
        }
        ctx.restore();

        b.alpha *= 0.86;
      }

      animId = requestAnimationFrame(render);
    }

    animId = requestAnimationFrame(render);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (strikeTimeout) clearTimeout(strikeTimeout);
      window.removeEventListener('resize', handleResize);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      {/* Sky illumination flash */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          background:
            'radial-gradient(circle at 50% 18%, rgba(165, 243, 252, 0.85), rgba(255, 226, 154, 0.3) 45%, transparent 78%)',
          opacity: flashOpacity,
          transition: 'opacity 90ms ease-out',
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}
