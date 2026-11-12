// JS side of the motion system (mirrors src/styles/motion.css).
// Use these for Web Animations API / requestAnimationFrame animations.

export const DURATION = {
  micro: 150,
  standard: 250,
  page: 400,
};

export const EASING = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  in: "cubic-bezier(0.4, 0, 1, 1)",
};

// Numeric version of EASING.out for requestAnimationFrame (count-up).
// cubic-bezier(0.16, 1, 0.3, 1) is very close to easeOutExpo-like curves;
// this solves the bezier for x -> y.
const bezier = (p1x, p1y, p2x, p2y) => {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t) => (3 * ax * t + 2 * bx) * t + cx;

  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    let t = x;
    for (let i = 0; i < 6; i++) {
      const dx = sampleX(t) - x;
      const d = sampleDX(t);
      if (Math.abs(dx) < 1e-5 || Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }

    return sampleY(Math.min(Math.max(t, 0), 1));
  };
};

export const easeOut = bezier(0.16, 1, 0.3, 1);

export const prefersReducedMotion = () => {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};
