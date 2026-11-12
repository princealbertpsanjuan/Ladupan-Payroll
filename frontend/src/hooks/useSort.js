import { useMemo, useState } from "react";

// Client-side sorting for tables.
// accessors: { columnKey: (row) => value } — strings sort A→Z, numbers 0→9.
const useSort = (rows, accessors, initial = { key: null, direction: "asc" }) => {
  const [sort, setSort] = useState(initial);

  const toggleSort = (key) => {
    setSort((current) => {
      if (current.key !== key) return { key, direction: "asc" };
      if (current.direction === "asc") return { key, direction: "desc" };
      return { key: null, direction: "asc" }; // third click: original order
    });
  };

  const sortedRows = useMemo(() => {
    if (!sort.key || !accessors[sort.key]) return rows;

    const get = accessors[sort.key];
    const factor = sort.direction === "asc" ? 1 : -1;

    return [...rows].sort((a, b) => {
      const left = get(a);
      const right = get(b);

      if (left === right) return 0;
      if (left === null || left === undefined || left === "") return 1;
      if (right === null || right === undefined || right === "") return -1;

      if (typeof left === "number" && typeof right === "number") {
        return (left - right) * factor;
      }

      return String(left).localeCompare(String(right), "en", { numeric: true }) * factor;
    });
    // accessors is a stable object defined by the caller
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);

  return { sortedRows, sort, toggleSort };
};

export default useSort;
