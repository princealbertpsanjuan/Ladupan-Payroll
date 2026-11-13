import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { SkeletonBlock } from "./Skeleton";
import "../styles/notifications.css";

const LEVEL_ICON = {
  alert: "wifiOff",
  warning: "alert",
  success: "check",
  info: "bell",
};

const timeAgo = (date) => {
  const seconds = Math.max(Math.floor((Date.now() - new Date(date).getTime()) / 1000), 0);

  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;

  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// Notification list that opens beside the sidebar (or under the top bar
// on phones). Scales and fades in; closes on outside click or Escape.
const NotificationPanel = ({ open, onClose, notifications, unreadCount, loaded, markRead, markAllRead }) => {
  const navigate = useNavigate();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };

    const onPointer = (event) => {
      if (panelRef.current?.contains(event.target)) return;
      if (event.target.closest?.("[data-notification-trigger]")) return;
      onClose();
    };

    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, onClose]);

  const openItem = (item) => {
    if (!item.isRead) markRead(item._id);
    onClose();
    if (item.link) navigate(item.link);
  };

  return (
    <div
      ref={panelRef}
      className={`notification-panel${open ? " is-open" : ""}`}
      role="dialog"
      aria-label="Notifications"
      aria-hidden={!open}
    >
      <div className="notification-panel-header">
        <div>
          <strong>Notifications</strong>
          <span>{unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}</span>
        </div>

        {unreadCount > 0 && (
          <button type="button" className="link-btn" onClick={markAllRead} tabIndex={open ? 0 : -1}>
            Mark all read
          </button>
        )}
      </div>

      <div className="notification-list">
        {!loaded ? (
          <div className="notification-empty">
            <SkeletonBlock lines={3} />
          </div>
        ) : notifications.length === 0 ? (
          <div className="notification-empty">
            <Icon name="bell" size={22} />
            <p>No notifications yet.</p>
          </div>
        ) : (
          notifications.map((item) => (
            <button
              key={item._id}
              type="button"
              className={`notification-item level-${item.level}${item.isRead ? "" : " is-unread"}`}
              onClick={() => openItem(item)}
              tabIndex={open ? 0 : -1}
            >
              <span className="notification-icon">
                <Icon name={LEVEL_ICON[item.level] || "bell"} size={16} />
              </span>

              <span className="notification-text">
                <strong>{item.title}</strong>
                {item.message && <span>{item.message}</span>}
                <small>{timeAgo(item.createdAt)}</small>
              </span>

              {!item.isRead && <span className="notification-dot" aria-label="Unread" />}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;
