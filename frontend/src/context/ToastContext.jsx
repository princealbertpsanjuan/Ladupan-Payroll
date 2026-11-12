import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Icon from "../components/Icon";
import { DURATION, prefersReducedMotion } from "../utils/motion";
import "../styles/toast.css";

const ToastContext = createContext(null);

const AUTO_DISMISS = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 6000,
};

const ICONS = {
  success: "check",
  info: "info",
  warning: "alert",
  error: "alert",
};

let nextId = 1;

const Toast = ({ toast, onDismiss }) => {
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(toast.duration);
  const startedAt = useRef(Date.now());
  const timer = useRef(null);

  const close = useCallback(() => {
    if (leaving) return;
    setLeaving(true);

    // Wait for the exit animation before removing the toast
    const exitTime = prefersReducedMotion() ? 0 : DURATION.micro;
    window.setTimeout(() => onDismiss(toast.id), exitTime);
  }, [leaving, onDismiss, toast.id]);

  // Auto-dismiss, paused while hovered or focused
  useEffect(() => {
    if (paused || leaving) return undefined;

    startedAt.current = Date.now();
    timer.current = window.setTimeout(close, remaining.current);

    return () => {
      window.clearTimeout(timer.current);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, leaving, close]);

  return (
    <div
      className={`lp-toast ${toast.type}${leaving ? " is-leaving" : ""}${paused ? " is-paused" : ""}`}
      role={toast.type === "error" || toast.type === "warning" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="lp-toast-icon">
        <Icon name={ICONS[toast.type] || "info"} size={16} strokeWidth={2.2} />
      </span>

      <div className="lp-toast-body">
        {toast.title && <strong>{toast.title}</strong>}
        <p>{toast.message}</p>
      </div>

      <button type="button" className="lp-toast-close" onClick={close} aria-label="Dismiss">
        <Icon name="close" size={14} strokeWidth={2} />
      </button>

      <span
        className="lp-toast-progress"
        style={{ animationDuration: `${toast.duration}ms` }}
        aria-hidden="true"
      />
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((type, message, options = {}) => {
    if (!message) return;

    const toast = {
      id: nextId++,
      type,
      message,
      title: options.title,
      duration: options.duration || AUTO_DISMISS[type] || 4000,
    };

    // Keep the stack short
    setToasts((current) => [...current.slice(-3), toast]);
  }, []);

  const api = useMemo(
    () => ({
      show,
      success: (message, options) => show("success", message, options),
      error: (message, options) => show("error", message, options),
      warning: (message, options) => show("warning", message, options),
      info: (message, options) => show("info", message, options),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div className="lp-toast-viewport" aria-live="polite">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }

  return context;
};
