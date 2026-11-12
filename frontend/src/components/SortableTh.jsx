import Icon from "./Icon";

// Clickable table header for useSort.
const SortableTh = ({ label, column, sort, onSort, className = "" }) => {
  const active = sort.key === column;
  const ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : "none";

  return (
    <th className={`sortable-th ${className}`} aria-sort={ariaSort}>
      <button
        type="button"
        className={`sort-btn${active ? ` is-active ${sort.direction}` : ""}`}
        onClick={() => onSort(column)}
      >
        {label}
        <span className="sort-arrows" aria-hidden="true">
          <Icon name="chevronDown" size={14} strokeWidth={2} />
        </span>
      </button>
    </th>
  );
};

export default SortableTh;
