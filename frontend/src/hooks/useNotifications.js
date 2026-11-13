import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { useToast } from "../context/ToastContext";

const POLL_MS = 30000;

// Loads the signed-in user's notifications, checks for new ones every
// 30 seconds and when the tab comes back into focus, and shows a toast
// for each new arrival (not for ones already there when the page opened).
const useNotifications = () => {
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const seenIds = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get("/notifications");
      const list = res.data?.notifications || [];

      // Toast only for notifications we have not seen before
      if (seenIds.current) {
        list
          .filter((item) => !item.isRead && !seenIds.current.has(item._id))
          .slice(0, 3)
          .reverse()
          .forEach((item) => {
            const show = item.level === "alert" || item.level === "warning" ? toast.warning : toast.info;
            show(item.message || item.title, { title: item.title });
          });
      }

      seenIds.current = new Set(list.map((item) => item._id));
      setNotifications(list);
      setUnreadCount(res.data?.unreadCount || 0);
    } catch {
      // Network hiccup: try again on the next poll
    } finally {
      setLoaded(true);
    }
  }, [toast]);

  useEffect(() => {
    fetchNotifications();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") fetchNotifications();
    }, POLL_MS);

    const onFocus = () => fetchNotifications();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchNotifications]);

  const markRead = useCallback(async (id) => {
    setNotifications((current) =>
      current.map((item) => (item._id === id ? { ...item, isRead: true } : item))
    );
    setUnreadCount((count) => Math.max(count - 1, 0));

    try {
      await api.put(`/notifications/${id}/read`);
    } catch {
      // will resync on the next poll
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);

    try {
      await api.put("/notifications/read-all");
    } catch {
      // will resync on the next poll
    }
  }, []);

  return { notifications, unreadCount, loaded, refresh: fetchNotifications, markRead, markAllRead };
};

export default useNotifications;
