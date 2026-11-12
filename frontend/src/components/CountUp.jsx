import useCountUp from "../hooks/useCountUp";
import { formatMoney } from "../utils/format";

// Number that counts up to its value.
// format: "money" (₱1,234.50), "integer" (1,234), or a custom function.
const CountUp = ({ value, format = "integer", delay = 0 }) => {
  const display = useCountUp(value, { delay });

  let text;

  if (typeof format === "function") {
    text = format(display);
  } else if (format === "money") {
    text = formatMoney(display);
  } else {
    text = Math.round(display).toLocaleString("en-PH");
  }

  return (
    <span className="lp-countup" aria-label={typeof format === "function" ? format(value) : format === "money" ? formatMoney(value) : Number(value || 0).toLocaleString("en-PH")}>
      <span aria-hidden="true">{text}</span>
    </span>
  );
};

export default CountUp;
