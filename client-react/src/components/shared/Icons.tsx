/** SVG icons matching the classic app's icon set (Feather-style, 15x15 nav-icon) */

interface IconProps {
  size?: number;
  className?: string;
}

const defaults = {
  xmlns: "http://www.w3.org/2000/svg",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

function Icon({
  size = 15,
  className = "nav-icon",
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...defaults}
    >
      {children}
    </svg>
  );
}

// --- Workspace view icons ---

export function IconFocus(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 2 7 10h3v6h4v-6h3z" />
      <path d="M5 18a7 7 0 0 1 14 0" />
      <path d="M8 22h8" />
    </Icon>
  );
}

export function IconDesk(p: IconProps) {
  return (
    <Icon {...p}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </Icon>
  );
}

export function IconEverything(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3" y="5" width="6" height="6" rx="1" />
      <path d="m3 17 2 2 4-4" />
      <path d="M13 6h8" />
      <path d="M13 12h8" />
      <path d="M13 18h8" />
    </Icon>
  );
}

export function IconToday(p: IconProps) {
  return (
    <Icon {...p}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
      <path d="M8 18h.01" />
      <path d="M12 18h.01" />
      <path d="M16 18h.01" />
    </Icon>
  );
}

export function IconUpcoming(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16.5 12" />
    </Icon>
  );
}

export function IconCompleted(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

export function IconWaiting(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M8 2h8" />
      <path d="M8 22h8" />
      <path d="M9 2v5a3 3 0 0 0 1 2.24l1.5 1.38a2 2 0 0 1 0 2.76L10 14.76A3 3 0 0 0 9 17v5" />
      <path d="M15 2v5a3 3 0 0 1-1 2.24l-1.5 1.38a2 2 0 0 0 0 2.76l1.5 1.38A3 3 0 0 1 15 17v5" />
    </Icon>
  );
}

export function IconScheduled(p: IconProps) {
  return (
    <Icon {...p}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
      <path d="m9 16 2 2 4-5" />
    </Icon>
  );
}

export function IconSomeday(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M7 3h10" />
      <path d="M5 7h14" />
      <path d="M7 11h10" />
      <path d="M9 15h6" />
      <path d="M11 19h2" />
    </Icon>
  );
}

export function IconTuneUp({ size = 15, className = "nav-icon" }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 21v-7" /><path d="M4 10V3" /><path d="M12 21v-9" /><path d="M12 8V3" /><path d="M20 21v-5" /><path d="M20 12V3" />
      <path d="M1 14h6" /><path d="M9 8h6" /><path d="M17 16h6" />
    </svg>
  );
}

// --- Utility icons ---

export function IconSettings(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

export function IconFeedback(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Icon>
  );
}

export function IconSearch({ size = 14, className = "nav-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </Icon>
  );
}

export function IconPlus({ size = 14, className = "app-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Icon>
  );
}

export function IconMoon({ size = 16, className = "app-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </Icon>
  );
}

export function IconSun({ size = 16, className = "app-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </Icon>
  );
}

export function IconUser({ size = 16, className = "app-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M6 20a6 6 0 0 1 12 0" />
    </Icon>
  );
}

export function IconSidebar({ size = 18, className = "app-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
    </Icon>
  );
}

export function IconCalendar({ size = 14, className = "app-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </Icon>
  );
}

export function IconFolder({ size = 14, className = "app-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </Icon>
  );
}

export function IconAi({ size = 15, className = "nav-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </Icon>
  );
}

export function IconClose({ size = 14, className = "app-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  );
}

export function IconKebab({ size = 14, className = "app-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </Icon>
  );
}

export function IconMenu({ size = 18, className = "app-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </Icon>
  );
}

// --- Home dashboard tile icons ---

export function IconTarget({ size = 16, className = "home-tile__icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </Icon>
  );
}

export function IconLightning({ size = 16, className = "home-tile__icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </Icon>
  );
}

// --- View mode icons ---

export function IconList({ size = 14, className = "app-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <line x1="8" x2="21" y1="6" y2="6" />
      <line x1="8" x2="21" y1="12" y2="12" />
      <line x1="8" x2="21" y1="18" y2="18" />
      <line x1="3" x2="3.01" y1="6" y2="6" />
      <line x1="3" x2="3.01" y1="12" y2="12" />
      <line x1="3" x2="3.01" y1="18" y2="18" />
    </Icon>
  );
}

export function IconBoard({ size = 14, className = "app-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </Icon>
  );
}

export function IconKeyboard({ size = 15, className = "nav-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="M6 8h.001" />
      <path d="M10 8h.001" />
      <path d="M14 8h.001" />
      <path d="M18 8h.001" />
      <path d="M8 12h.001" />
      <path d="M12 12h.001" />
      <path d="M16 12h.001" />
      <path d="M7 16h10" />
    </Icon>
  );
}

export function IconShield({ size = 15, className = "nav-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67 0C8.5 20.5 5 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </Icon>
  );
}

export function IconDownload({ size = 15, className = "nav-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </Icon>
  );
}

export function IconHelp({ size = 15, className = "nav-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </Icon>
  );
}

export function IconLogout({ size = 15, className = "nav-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </Icon>
  );
}

export function IconGrip({ size = 14, className = "app-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <circle cx="9" cy="5" r="1" />
      <circle cx="15" cy="5" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="9" cy="19" r="1" />
      <circle cx="15" cy="19" r="1" />
    </Icon>
  );
}

export function IconCheck({ size = 14, className = "app-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M20 6 9 17l-5-5" />
    </Icon>
  );
}

export function IconClock({ size = 14, className = "app-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Icon>
  );
}

export function IconArchive({ size = 14, className = "app-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </Icon>
  );
}

export function IconXCircle({ size = 14, className = "app-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </Icon>
  );
}

export function IconRefresh({ size = 14, className = "app-icon" }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </Icon>
  );
}
