import { useLayoutEffect, useRef } from "react";
import { DURATION, EASING, prefersReducedMotion } from "../utils/motion";

// Smoothly moves table rows to their new positions after sorting or
// filtering (FLIP: First, Last, Invert, Play — transform only).
// Rows need a data-key attribute. `orderKey` should change whenever the
// order or filter changes (e.g. `${sort.key}-${sort.direction}-${search}`).
const useFlipList = (containerRef, orderKey) => {
  const positions = useRef(new Map());
  const lastOrderKey = useRef(orderKey);

  // Runs after every render: animate if the order changed, then remember
  // the current positions for next time.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const rows = Array.from(container.querySelectorAll(":scope > tr[data-key]"));
    const next = new Map();

    rows.forEach((row) => {
      next.set(row.dataset.key, row.offsetTop);
    });

    const orderChanged = lastOrderKey.current !== orderKey;
    lastOrderKey.current = orderKey;

    if (orderChanged && positions.current.size > 0 && !prefersReducedMotion()) {
      rows.forEach((row) => {
        const before = positions.current.get(row.dataset.key);
        const after = next.get(row.dataset.key);

        if (before === undefined || before === after || !row.animate) return;

        row.animate(
          [{ transform: `translateY(${before - after}px)` }, { transform: "none" }],
          { duration: DURATION.standard, easing: EASING.standard }
        );
      });
    }

    positions.current = next;
  });
};

export default useFlipList;
