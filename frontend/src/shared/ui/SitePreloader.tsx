import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react";
import "./SitePreloader.css";

interface Particle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
}

const HIGHLIGHT_COLOR = "#10b981";
const DURATION_MS = 2400;

export function SitePreloader({
  onFinish,
}: {
  onFinish?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return true;
  });
  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(0);

  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -9999,
    y: -9999,
    active: false,
  });

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      onFinish?.();
    }, 600);
  }, [onFinish]);

  useEffect(() => {
    if (!visible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = Math.min(window.innerWidth - 32, 1100);
    const height = Math.min(window.innerHeight * 0.52, 340);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Create offscreen canvas to sample text pixels
    const offscreen = document.createElement("canvas");
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return;

    const fontSize = Math.min(width / 6.4, 96);
    offCtx.font = `800 ${fontSize}px "Manrope", "DM Sans", -apple-system, sans-serif`;
    offCtx.textAlign = "center";
    offCtx.textBaseline = "middle";
    offCtx.fillStyle = "#ffffff";
    offCtx.fillText("EcoByteMetrics", width / 2, height / 2);

    const imgData = offCtx.getImageData(0, 0, width, height).data;
    const particles: Particle[] = [];
    const step = Math.max(3, Math.floor(fontSize / 22));

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4;
        const alpha = imgData[idx + 3] ?? 0;
        if (alpha > 128) {
          const isHighlight = Math.random() < 0.48;
          const color = isHighlight ? HIGHLIGHT_COLOR : "#f0fdf4";
          const angle = Math.random() * Math.PI * 2;
          const spread = Math.random() * Math.max(width, height) * 0.7;

          particles.push({
            x: width / 2 + Math.cos(angle) * spread,
            y: height / 2 + Math.sin(angle) * spread,
            targetX: x,
            targetY: y,
            vx: 0,
            vy: 0,
            size: Math.random() * 2.0 + 1.4,
            color,
            alpha: Math.random() * 0.45 + 0.55,
          });
        }
      }
    }

    let frameId: number;
    const startTime = performance.now();

    const loop = (now: number) => {
      const elapsed = now - startTime;
      const curProgress = Math.min((elapsed / DURATION_MS) * 100, 100);
      setProgress(Math.round(curProgress));

      ctx.clearRect(0, 0, width, height);

      const mouse = mouseRef.current;

      for (const p of particles) {
        // Attraction to target
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        p.vx += dx * 0.055;
        p.vy += dy * 0.055;

        // Mouse repulsion
        if (mouse.active) {
          const mx = p.x - mouse.x;
          const my = p.y - mouse.y;
          const dist = Math.hypot(mx, my);
          const repelRadius = 110;
          if (dist < repelRadius && dist > 0) {
            const force = (repelRadius - dist) / repelRadius;
            p.vx += (mx / dist) * force * 16;
            p.vy += (my / dist) * force * 16;
          }
        }

        // Friction
        p.vx *= 0.82;
        p.vy *= 0.82;
        p.x += p.vx;
        p.y += p.vy;

        // Render particle
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (curProgress < 100) {
        frameId = requestAnimationFrame(loop);
      } else {
        dismiss();
      }
    };

    frameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [visible, dismiss]);

  if (!visible) return null;

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    mouseRef.current = {
      x: clientX - rect.left,
      y: clientY - rect.top,
      active: true,
    };
  };

  const handleMouseMove = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    handlePointerMove(e.clientX, e.clientY);
  };

  const handleTouchMove = (e: ReactTouchEvent<HTMLCanvasElement>) => {
    const firstTouch = e.touches[0];
    if (firstTouch) {
      handlePointerMove(firstTouch.clientX, firstTouch.clientY);
    }
  };

  const handlePointerLeave = () => {
    mouseRef.current.active = false;
  };

  return (
    <div
      className={`site-preloader ${exiting ? "site-preloader--exiting" : ""}`}
      role="status"
      aria-label="Carregando plataforma"
      onClick={dismiss}
    >
      <canvas
        ref={canvasRef}
        className="site-preloader__canvas"
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        onMouseLeave={handlePointerLeave}
        onTouchEnd={handlePointerLeave}
      />
      <div className="site-preloader__footer" onClick={(e) => e.stopPropagation()}>
        <div className="site-preloader__progress-bar">
          <div
            className="site-preloader__progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="site-preloader__meta">
          <span>{progress}%</span>
        </div>
      </div>
    </div>
  );
}
