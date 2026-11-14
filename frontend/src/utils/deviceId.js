// A random ID for this phone/browser, created once and kept in local
// storage. The server uses it to recognise the employee's registered
// phone when device binding is on. Signing out keeps it.
const KEY = "lp_device_id";

const randomId = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();

  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

let cached = null;

export const getDeviceId = () => {
  if (cached) return cached;

  try {
    let id = localStorage.getItem(KEY);
    if (!id || !/^[A-Za-z0-9-]{16,64}$/.test(id)) {
      id = randomId();
      localStorage.setItem(KEY, id);
    }
    cached = id;
  } catch {
    // Storage blocked (private mode): an ID for this visit only
    cached = cached || randomId();
  }

  return cached;
};
