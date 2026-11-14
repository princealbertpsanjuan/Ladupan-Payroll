const crypto = require("crypto");

// Every browser / installed app keeps a random ID (created on first use)
// and sends it in this header. Only its hash is stored on the server.
const DEVICE_HEADER = "x-device-id";

const getDeviceId = (req) => {
  const value = String(req.get(DEVICE_HEADER) || "").trim();
  return /^[A-Za-z0-9-]{16,64}$/.test(value) ? value : null;
};

const hashDeviceId = (deviceId) =>
  crypto.createHash("sha256").update(String(deviceId)).digest("hex");

// Short readable description of the phone, e.g. "iPhone · Safari"
const describeDevice = (userAgent = "") => {
  const ua = String(userAgent);

  let device = "Computer";
  if (/iPhone/i.test(ua)) device = "iPhone";
  else if (/iPad/i.test(ua)) device = "iPad";
  else if (/Android/i.test(ua)) {
    const model = ua.match(/Android [\d.]+; (?:[a-z]{2}-[a-z]{2}; )?([^;)]+?)(?: Build|\))/i);
    device = model && model[1] && !/^K$/i.test(model[1].trim()) ? `Android (${model[1].trim()})` : "Android";
  } else if (/Windows/i.test(ua)) device = "Windows PC";
  else if (/Macintosh/i.test(ua)) device = "Mac";

  let browser = "Browser";
  if (/EdgA?\//i.test(ua)) browser = "Edge";
  else if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/CriOS|Chrome\//i.test(ua)) browser = "Chrome";
  else if (/FxiOS|Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";

  return `${device} · ${browser}`;
};

module.exports = { DEVICE_HEADER, getDeviceId, hashDeviceId, describeDevice };
