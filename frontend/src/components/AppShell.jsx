import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/ladupan-logo.png";
import Icon from "./Icon";
import NotificationPanel from "./NotificationPanel";
import useNotifications from "../hooks/useNotifications";
import { DURATION, EASING, prefersReducedMotion } from "../utils/motion";
import "../styles/layout.css";

const SIDEBAR_WIDTH = 264;
const RAIL_WIDTH = 76;
const MOBILE_QUERY = "(max-width: 900px)";
const STORAGE_KEY = "lp-sidebar-collapsed";

const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;

const readCollapsed = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

// Shared layout for the admin and employee sides.
// - Sidebar collapses to an icon rail. Only transforms animate: the dark
//   panel slides, labels fade, and the page content glides over (FLIP).
// - A highlight slides to the active menu item.
// - On small screens the sidebar becomes a drawer with a blurred backdrop.
// - Each route change fades the page in with a slight upward slide.
const AppShell = ({ navItems, subtitle }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationState = useNotifications();
  const { unreadCount } = notificationState;
  const closeNotifications = useCallback(() => setNotificationsOpen(false), []);
  const [indicator, setIndicator] = useState({ y: 0, height: 0, width: 0, visible: false });
  const [indicatorReady, setIndicatorReady] = useState(false);

  const navRef = useRef(null);
  const mainRef = useRef(null);
  const previousCollapsed = useRef(collapsed);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // Place the highlight on the active link
  const measureIndicator = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;

    const active = nav.querySelector("a.active");

    if (!active) {
      setIndicator((current) => ({ ...current, visible: false }));
      return;
    }

    setIndicator({
      y: active.offsetTop,
      height: active.offsetHeight,
      width: active.offsetWidth,
      visible: true,
    });
  }, []);

  useLayoutEffect(() => {
    measureIndicator();
  }, [location.pathname, collapsed, measureIndicator]);

  // Enable the sliding transition only after the first placement,
  // so the highlight does not fly in from the top on page load
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIndicatorReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    window.addEventListener("resize", measureIndicator);
    return () => window.removeEventListener("resize", measureIndicator);
  }, [measureIndicator]);

  // Collapse / expand: content jumps to its new position, then glides
  // from the old one (transform only, no width animation)
  useLayoutEffect(() => {
    if (previousCollapsed.current === collapsed) return;
    previousCollapsed.current = collapsed;

    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // storage unavailable; the choice just will not be remembered
    }

    const main = mainRef.current;
    if (!main || isMobile() || prefersReducedMotion() || !main.animate) return;

    const shift = SIDEBAR_WIDTH - RAIL_WIDTH;

    main.animate(
      [
        { transform: `translateX(${collapsed ? shift : -shift}px)` },
        { transform: "none" },
      ],
      { duration: DURATION.standard, easing: EASING.standard }
    );
  }, [collapsed]);

  // Close the mobile drawer and notification panel after navigating
  useEffect(() => {
    setDrawerOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  // Escape closes the drawer
  useEffect(() => {
    if (!drawerOpen) return undefined;

    const onKey = (event) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const initials = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase() || "L";

  return (
    <div
      className={`app-shell${collapsed ? " is-collapsed" : ""}${drawerOpen ? " is-drawer-open" : ""}`}
    >
      {/* Small screens: top bar with menu button */}
      <header className="mobile-topbar">
        <button
          type="button"
          className="shell-icon-btn"
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          <Icon name="menu" />
        </button>

        <img src={logo} alt="" className="mobile-topbar-logo" />
        <strong>Ladupan</strong>
        <span className="mobile-topbar-sub">{subtitle}</span>

        <button
          type="button"
          className="shell-icon-btn mobile-bell"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
          aria-expanded={notificationsOpen}
          data-notification-trigger
          onClick={() => setNotificationsOpen((value) => !value)}
        >
          <Icon name="bell" />
          {unreadCount > 0 && (
            <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
          )}
        </button>
      </header>

      <div
        className="drawer-backdrop"
        aria-hidden="true"
        onClick={() => setDrawerOpen(false)}
      />

      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-panel" aria-hidden="true" />

        <div className="sidebar-brand">
          <img src={logo} alt="Ladupan Logo" className="sidebar-logo" />

          <div className="sidebar-brand-text sidebar-fade">
            <strong>Ladupan</strong>
            <span>{subtitle}</span>
          </div>

          <button
            type="button"
            className="shell-icon-btn drawer-close"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>

        <nav ref={navRef}>
          <span
            className={`nav-indicator${indicatorReady ? " is-ready" : ""}`}
            aria-hidden="true"
            style={{
              transform: `translateY(${indicator.y}px)`,
              height: indicator.height,
              width: indicator.width,
              opacity: indicator.visible ? 1 : 0,
            }}
          />

          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} title={collapsed ? item.label : undefined}>
              <Icon name={item.icon} className="nav-icon" />
              <span className="nav-label sidebar-fade">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" title={collapsed ? `${user?.firstName || ""} ${user?.lastName || ""}` : undefined}>
            <span className="sidebar-avatar">{initials}</span>
            <span className="sidebar-user-text sidebar-fade">
              <strong>
                {user?.firstName} {user?.lastName}
              </strong>
              <span>{user?.email}</span>
            </span>
          </div>

          <button
            type="button"
            className="sidebar-action notification-trigger"
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
            aria-expanded={notificationsOpen}
            data-notification-trigger
            title={collapsed ? "Notifications" : undefined}
            onClick={() => setNotificationsOpen((value) => !value)}
          >
            <span className="sidebar-bell-icon">
              <Icon name="bell" />
              <span className={`notification-dot-mini${unreadCount ? " has-unread" : ""}`} />
            </span>
            <span className="nav-label sidebar-fade">Notifications</span>
            {unreadCount > 0 && (
              <span className="notification-badge sidebar-fade">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            className="sidebar-action collapse-toggle"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : undefined}
          >
            <Icon name="chevronLeft" className="collapse-icon" />
            <span className="nav-label sidebar-fade">Collapse</span>
          </button>

          <button
            type="button"
            className="sidebar-action logout-btn"
            onClick={handleLogout}
            title={collapsed ? "Logout" : undefined}
          >
            <Icon name="logout" />
            <span className="nav-label sidebar-fade">Logout</span>
          </button>
        </div>
      </aside>

      <NotificationPanel
        open={notificationsOpen}
        onClose={closeNotifications}
        {...notificationState}
      />

      <main ref={mainRef} className="main-content">
        <div key={location.pathname} className="page-transition">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppShell;
