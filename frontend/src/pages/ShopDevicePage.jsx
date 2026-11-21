import { useEffect, useRef, useState } from "react";
import axios from "axios";
import logo from "../assets/ladupan-logo.png";
import "../styles/shopDevice.css";

// Screen for the phone / tablet that stays at a branch. Once paired, it
// tells the server the shop's current internet address every minute, so
// Time In keeps working after power interruptions change the address.
// No user login: it uses its own device key from pairing.

const TOKEN_KEY = "lp_shop_device_token";
const LABEL_KEY = "lp_shop_device_label";
const CHECK_EVERY_MS = 60 * 1000;

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout: 20000,
});

const readStorage = (key) => {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
};

const writeStorage = (key, value) => {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Storage blocked: pairing lasts until the page is closed
  }
};

// The shop's public IPv4 / IPv6 (whichever exist). Failures are fine: the
// server also sees the address the check-in comes from.
const lookup = async (url) => {
  try {
    const res = await axios.get(url, { timeout: 8000 });
    return res.data?.ip || "";
  } catch {
    return "";
  }
};

const ShopDevicePage = () => {
  const [token, setToken] = useState(readStorage(TOKEN_KEY));
  const [label, setLabel] = useState(readStorage(LABEL_KEY));
  const [code, setCode] = useState("");
  const [pairing, setPairing] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState({ state: "starting", addresses: [], at: null, message: "" });
  const [now, setNow] = useState(new Date());
  const [screenLock, setScreenLock] = useState("unknown");
  const wakeLockRef = useRef(null);

  // Keep the screen on while this page is open (Android Chrome)
  useEffect(() => {
    if (!token) return undefined;

    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator && document.visibilityState === "visible") {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
          setScreenLock("on");
          wakeLockRef.current.addEventListener?.("release", () => setScreenLock("off"));
        } else if (!("wakeLock" in navigator)) {
          setScreenLock("unsupported");
        }
      } catch {
        setScreenLock("off");
      }
    };

    requestWakeLock();
    const onVisible = () => {
      if (document.visibilityState === "visible") requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      wakeLockRef.current?.release?.().catch(() => {});
    };
  }, [token]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Check in now and every minute
  useEffect(() => {
    if (!token) return undefined;
    let stopped = false;

    const checkIn = async () => {
      const [ipv4, ipv6] = await Promise.all([
        lookup("https://api.ipify.org?format=json"),
        lookup("https://api6.ipify.org?format=json"),
      ]);

      try {
        const res = await client.post(
          "/shop-device/heartbeat",
          { ipv4, ipv6 },
          { headers: { "X-Shop-Device-Token": token } }
        );
        if (stopped) return;
        setLabel(res.data.label);
        writeStorage(LABEL_KEY, res.data.label);
        setStatus({ state: "ok", addresses: res.data.addresses || [], at: new Date(), message: "" });
      } catch (err) {
        if (stopped) return;

        if (err.response?.status === 401) {
          writeStorage(TOKEN_KEY, "");
          writeStorage(LABEL_KEY, "");
          setToken("");
          setLabel("");
          setError("This device was unpaired by the admin. Enter a new code to pair it again.");
          return;
        }

        setStatus((current) => ({
          ...current,
          state: "error",
          message: err.response?.data?.message || "No internet connection. Retrying every minute...",
        }));
      }
    };

    checkIn();
    const timer = setInterval(checkIn, CHECK_EVERY_MS);
    const onOnline = () => checkIn();
    window.addEventListener("online", onOnline);

    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [token]);

  const pair = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setPairing(true);
      const res = await client.post("/shop-device/pair", { code });
      writeStorage(TOKEN_KEY, res.data.token);
      writeStorage(LABEL_KEY, res.data.label);
      setLabel(res.data.label);
      setToken(res.data.token);
      setCode("");
    } catch (err) {
      setError(err.response?.data?.message || "Pairing failed. Check the internet connection.");
    } finally {
      setPairing(false);
    }
  };

  const clock = now.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", second: "2-digit" });

  if (!token) {
    return (
      <div className="shop-device">
        <div className="shop-device-card">
          <img src={logo} alt="" className="shop-device-logo" />
          <h1>Pair this shop device</h1>
          <p>
            In the admin account, open <strong>Shop Network → Shop devices → Pair a shop device</strong>,
            then enter the 6-digit code here.
          </p>

          <form onSubmit={pair} className="shop-device-form">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              aria-label="Pairing code"
              required
            />
            <button type="submit" disabled={pairing || code.length !== 6}>
              {pairing ? "Pairing..." : "Pair device"}
            </button>
          </form>

          {error && <p className="shop-device-error">{error}</p>}

          <p className="shop-device-hint">
            Use a phone or tablet that stays at the shop, plugged in, connected only to the shop
            Wi-Fi (mobile data off).
          </p>
        </div>
      </div>
    );
  }

  const ok = status.state === "ok";

  return (
    <div className={`shop-device ${ok ? "is-ok" : status.state === "error" ? "is-error" : ""}`}>
      <div className="shop-device-card">
        <img src={logo} alt="" className="shop-device-logo" />
        <p className="shop-device-label">{label || "Shop device"}</p>
        <h1>{ok ? "Connected" : status.state === "error" ? "Not connected" : "Connecting..."}</h1>
        <p className="shop-device-clock">{clock}</p>

        {ok && (
          <p>
            Shop address: <strong>{status.addresses.join(", ")}</strong>
            <br />
            <span className="shop-device-muted">
              Last check {status.at?.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" })}{" "}
              · checks every minute
            </span>
          </p>
        )}

        {status.state === "error" && <p className="shop-device-error">{status.message}</p>}

        <ul className="shop-device-rules">
          <li>Keep this screen open and the device plugged in.</li>
          <li>Stay on the shop Wi-Fi only. Mobile data must be off.</li>
          <li>Never take this device out of the shop.</li>
          {screenLock !== "on" && (
            <li>
              Set the screen to stay on: Settings → Display → Screen timeout → longest, or Developer
              options → <em>Stay awake</em>.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default ShopDevicePage;
