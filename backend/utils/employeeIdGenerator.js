const Counter = require("../models/Counter");
const User = require("../models/User");

const PREFIX = "LDP-";
const COUNTER_NAME = "employeeId";

const formatEmployeeId = (number) => `${PREFIX}${String(number).padStart(4, "0")}`;

// Highest number already used by an LDP-#### Employee ID
const getHighestExistingNumber = async () => {
  const users = await User.find({
    employeeId: { $regex: `^${PREFIX}\\d+$` },
  }).select("employeeId");

  return users.reduce((highest, user) => {
    const number = Number(user.employeeId.replace(PREFIX, ""));
    return Number.isFinite(number) && number > highest ? number : highest;
  }, 0);
};

// Generates the next Employee ID (LDP-0001, LDP-0002, ...).
// Uses an atomic counter so two admins creating employees at the same time
// never get the same ID. On first use the counter starts after the highest
// existing LDP ID, so older accounts are never duplicated.
const generateEmployeeId = async () => {
  const existingCounter = await Counter.findById(COUNTER_NAME);

  if (!existingCounter) {
    const highest = await getHighestExistingNumber();

    try {
      await Counter.create({ _id: COUNTER_NAME, seq: highest });
    } catch (error) {
      // Another request created the counter first; that is fine.
      if (error.code !== 11000) throw error;
    }
  }

  for (let attempt = 0; attempt < 20; attempt++) {
    const counter = await Counter.findByIdAndUpdate(
      COUNTER_NAME,
      { $inc: { seq: 1 } },
      { returnDocument: "after" }
    );

    const employeeId = formatEmployeeId(counter.seq);
    const taken = await User.exists({ employeeId });

    if (!taken) return employeeId;
  }

  throw new Error("Could not generate a unique Employee ID");
};

module.exports = { generateEmployeeId, formatEmployeeId };
