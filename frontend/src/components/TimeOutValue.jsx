// Time-out with a "+1 day" tag when it happened the day after the shift
// started (night shift, e.g. 18:00 -> 06:00).
const TimeOutValue = ({ record, empty = "-" }) => {
  if (!record?.timeOut) return empty;

  return (
    <>
      {record.timeOut}
      {record.timeOutNextDay && (
        <span className="next-day-tag" title="The next day">
          +1 day
        </span>
      )}
    </>
  );
};

export default TimeOutValue;
