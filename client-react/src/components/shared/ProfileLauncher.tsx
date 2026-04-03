import { useState, useEffect, useRef, useCallback } from "react";
import type { User } from "../../types";
import {
  IconUser,
  IconSettings,
  IconList,
  IconMoon,
  IconSun,
  IconKeyboard,
  IconFeedback,
  IconShield,
  IconHelp,
  IconLogout,
} from "../shared/Icons";

interface MenuItem {
  id: string;
  icon: React.ComponentType;
  label: string;
  action: () => void;
  danger?: boolean;
  dividerBefore?: boolean;
}

interface Props {
  user: User | null;
  dark: boolean;
  isAdmin: boolean;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenComponents: () => void;
  onToggleTheme: () => void;
  onOpenShortcuts: () => void;
  onOpenFeedback: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
}

function getInitials(user: User | null): string {
  if (!user) return "?";
  if (user.name) {
    return user.name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return user.email[0].toUpperCase();
}

function getDisplayName(user: User | null): string {
  if (!user) return "User";
  return user.name || user.email.split("@")[0];
}

export function ProfileLauncher({
  user,
  dark,
  isAdmin,
  onOpenProfile,
  onOpenSettings,
  onOpenComponents,
  onToggleTheme,
  onOpenShortcuts,
  onOpenFeedback,
  onOpenAdmin,
  onLogout,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const items: MenuItem[] = [
    {
      id: "profile",
      icon: IconUser,
      label: "Profile",
      action: onOpenProfile,
    },
    {
      id: "settings",
      icon: IconSettings,
      label: "Settings",
      action: onOpenSettings,
    },
    {
      id: "components",
      icon: IconList,
      label: "Component gallery",
      action: onOpenComponents,
    },
    {
      id: "theme",
      icon: dark ? IconSun : IconMoon,
      label: dark ? "Light mode" : "Dark mode",
      action: onToggleTheme,
    },
    {
      id: "shortcuts",
      icon: IconKeyboard,
      label: "Keyboard shortcuts",
      action: onOpenShortcuts,
    },
    {
      id: "feedback",
      icon: IconFeedback,
      label: "Send feedback",
      action: onOpenFeedback,
    },
    ...(isAdmin
      ? [
          {
            id: "admin",
            icon: IconShield,
            label: "Admin panel",
            action: onOpenAdmin,
            dividerBefore: true,
          },
        ]
      : []),
    {
      id: "help",
      icon: IconHelp,
      label: "Help & support",
      action: () => {},
      dividerBefore: !isAdmin,
    },
    {
      id: "logout",
      icon: IconLogout,
      label: "Sign out",
      action: onLogout,
      danger: true,
    },
  ];

  const handleSelect = useCallback((item: MenuItem) => {
    setOpen(false);
    // Delay so popover closes before navigation
    requestAnimationFrame(() => item.action());
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % items.length);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + items.length) % items.length);
      }
      if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        handleSelect(items[activeIndex]);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, activeIndex, items, handleSelect]);

  // Reset active index when opening
  useEffect(() => {
    if (open) setActiveIndex(-1);
  }, [open]);

  return (
    <div className="profile-launcher">
      {/* Popover panel — positioned above trigger */}
      {open && (
        <div
          ref={panelRef}
          className="profile-launcher__panel"
          role="menu"
          aria-label="Account menu"
        >
          {/* User info header */}
          <div className="profile-launcher__user-info">
            <div className="profile-launcher__avatar">{getInitials(user)}</div>
            <div className="profile-launcher__user-text">
              <span className="profile-launcher__name">
                {getDisplayName(user)}
                {user?.isVerified && (
                  <span className="verified-badge" title="Verified">
                    ✓
                  </span>
                )}
                {user?.role === "admin" && (
                  <span className="admin-badge" title="Admin">
                    ★
                  </span>
                )}
              </span>
              {user?.email && (
                <span className="profile-launcher__email">{user.email}</span>
              )}
            </div>
          </div>

          {/* Menu items */}
          <div className="profile-launcher__menu">
            {items.map((item, i) => (
              <div key={item.id}>
                {item.dividerBefore && (
                  <div className="profile-launcher__divider" />
                )}
                <button
                  className={`profile-launcher__menu-item${i === activeIndex ? " profile-launcher__menu-item--active" : ""}${item.danger ? " profile-launcher__menu-item--danger" : ""}`}
                  role="menuitem"
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trigger button */}
      <button
        ref={triggerRef}
        className="profile-launcher__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <div className="profile-launcher__avatar profile-launcher__avatar--sm">
          {getInitials(user)}
        </div>
        <div className="profile-launcher__trigger-text">
          <span className="profile-launcher__trigger-name">
            {getDisplayName(user)}
            {user?.isVerified && <span className="verified-badge">✓</span>}
            {user?.role === "admin" && <span className="admin-badge">★</span>}
          </span>
          {user?.email && (
            <span className="profile-launcher__trigger-email">
              {user.email}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}
