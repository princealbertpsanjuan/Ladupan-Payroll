import { useEffect, useRef, useState } from "react";
import { DURATION, easeOut, prefersReducedMotion } from "../utils/motion";

// Animates a number from its previous value to `target`.
// Duration follows the page timing (400ms) with the entrance easing.
// With reduced motion, the final value is shown immediately.
const useCountUp = (target, { duration = DURATION.page, delay = 0 } = {}) => {
  const value = Number(target) || 0;
  const [display, setDisplay] = useState(prefersReducedMotion() ? value : 0);
  const fromRef = useRef(prefersReducedMotion() ? value : 0);
  const frameRef = useRef(null);
  const displayRef = useRef(display);

  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      fromRef.current = value;
      return undefined;
    }

    const from = displayRef.current;
    if (from === value) return undefined;

    let start = null;
    let timeoutId = null;

    const step = (timestamp) => {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const next = from + (value - from) * easeOut(progress);

      setDisplay(progress >= 1 ? value : next);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = value;
      }
    };

    timeoutId = window.setTimeout(() => {
      frameRef.current = requestAnimationFrame(step);
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
      cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration, delay]);

  return display;
};

export default useCountUp;
