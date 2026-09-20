import React, { useEffect, useRef } from "react";

/**
 * VengeanceUI "Interactive Particles" — reinterpreted as a dependency-free
 * canvas field instead of the original Three.js + GSAP + GLSL implementation.
 *
 * The brief explicitly warns against unnecessary dependencies and against
 * anything that could make the site lag, so rather than pulling in Three.js
 * and GSAP for a single hero decoration, this keeps the same *concept*
 * (a cursor-reactive particle field with connecting lines, capped at ~30fps,
 * paused when off-screen or when the tab is hidden, disabled for
 * prefers-reduced-motion) implemented with plain 2D canvas.
 *
 * Renders as an absolutely-positioned, pointer-events:none layer so it never
 * intercepts clicks, form input, scrolling, or touch gestures.
 */
export function InteractiveParticles({ density = 55, color = "19,34,31", lineColor = "142,168,44", className = "" }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = canvas.getContext("2d");
    let width = 0, height = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let particles = [];
    let mouse = { x: -9999, y: -9999 };
    let visible = true;
    let rafId = null;
    let lastFrame = 0;
    const FRAME_MS = 1000 / 30; // 30fps cap, matches the source component's loop rate

    function resize() {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((width * height) / 9000) + Math.min(density, 90);
      particles = new Array(Math.min(count, 120)).fill(0).map(() => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.6 + 0.6,
      }));
    }

    function drawStatic() {
      // reduced-motion / initial paint: draw once, no loop
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color},.35)`;
        ctx.fill();
      });
    }

    function step(t) {
      rafId = requestAnimationFrame(step);
      if (!visible) return;
      if (t - lastFrame < FRAME_MS) return;
      lastFrame = t;

      ctx.clearRect(0, 0, width, height);
      const touchRadius = 110;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < touchRadius) {
          const force = (touchRadius - dist) / touchRadius;
          p.x += (dx / (dist || 1)) * force * 1.1;
          p.y += (dy / (dist || 1)) * force * 1.1;
        }
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        p.x = Math.max(0, Math.min(width, p.x));
        p.y = Math.max(0, Math.min(height, p.y));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color},.4)`;
        ctx.fill();
      }

      // connecting lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 90) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${lineColor},${(1 - d / 90) * 0.25})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
    }

    function onMouseMove(e) {
      const rect = container.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }
    function onMouseLeave() { mouse.x = -9999; mouse.y = -9999; }

    resize();
    if (reduceMotion) {
      drawStatic();
    } else {
      rafId = requestAnimationFrame(step);
      // touch/mouse interaction — passive listeners so scrolling/touch never blocks
      window.addEventListener("mousemove", onMouseMove, { passive: true });
      container.addEventListener("mouseleave", onMouseLeave, { passive: true });
    }

    const ro = new ResizeObserver(() => resize());
    ro.observe(container);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    }, { threshold: 0.05 });
    io.observe(container);

    function onVisibility() { visible = !document.hidden && visible; }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [density, color, lineColor]);

  return (
    <div ref={containerRef} className={`particle-field ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} className="particle-canvas" />
    </div>
  );
}

export default InteractiveParticles;
