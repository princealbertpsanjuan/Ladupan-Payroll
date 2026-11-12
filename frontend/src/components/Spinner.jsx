// Inline spinner for buttons. Usage:
// <button disabled={saving} aria-busy={saving}>
//   {saving && <Spinner />} {saving ? "Saving..." : "Save"}
// </button>
const Spinner = ({ large = false }) => (
  <span className={`btn-spinner${large ? " lg" : ""}`} role="presentation" aria-hidden="true" />
);

export default Spinner;
