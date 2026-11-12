// Skeleton placeholders shown while data loads.

const WIDTHS = ["72%", "54%", "88%", "46%", "64%", "80%", "38%"];

// Table rows: render inside <tbody>
export const SkeletonRows = ({ rows = 5, cols = 5 }) => (
  <>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <tr key={`skeleton-${rowIndex}`} className="skeleton-row" aria-hidden="true">
        {Array.from({ length: cols }).map((__, colIndex) => (
          <td key={colIndex}>
            <span
              className="skeleton"
              style={{ width: WIDTHS[(rowIndex + colIndex) % WIDTHS.length] }}
            />
          </td>
        ))}
      </tr>
    ))}
  </>
);

// A block of lines (cards, payslip)
export const SkeletonBlock = ({ lines = 3, className = "" }) => (
  <div className={`skeleton-block ${className}`} aria-hidden="true">
    {Array.from({ length: lines }).map((_, index) => (
      <span
        key={index}
        className="skeleton"
        style={{ width: index === 0 ? "40%" : WIDTHS[index % WIDTHS.length] }}
      />
    ))}
  </div>
);

// Inline value placeholder (e.g. a number in a stat card)
export const SkeletonText = ({ width = 64, height = 22 }) => (
  <span className="skeleton skeleton-inline" style={{ width, height }} aria-hidden="true" />
);
