/** Celebration — overlapping circles bursting outward. For "All clear" empty state. */
export function IllustrationCelebrate() {
  return (
    <svg width="140" height="120" viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="70" cy="60" r="32" fill="var(--m-amber)" opacity="0.2" />
      <circle cx="70" cy="60" r="20" fill="var(--m-amber)" opacity="0.35" />
      <circle cx="45" cy="40" r="14" fill="var(--m-accent)" opacity="0.25" />
      <circle cx="95" cy="40" r="10" fill="var(--m-success)" opacity="0.3" />
      <circle cx="50" cy="80" r="8" fill="var(--m-accent)" opacity="0.2" />
      <circle cx="100" cy="75" r="12" fill="var(--m-amber)" opacity="0.3" />
      <circle cx="30" cy="60" r="6" fill="var(--m-success)" opacity="0.25" />
      <circle cx="110" cy="55" r="7" fill="var(--m-accent)" opacity="0.2" />
      {/* Sparkle accents */}
      <path d="M70 30l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="var(--m-amber)" opacity="0.6" />
      <path d="M105 90l1.5 4.5 4.5 1.5-4.5 1.5-1.5 4.5-1.5-4.5-4.5-1.5 4.5-1.5z" fill="var(--m-accent)" opacity="0.5" />
      <path d="M25 45l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="var(--m-success)" opacity="0.4" />
    </svg>
  );
}

/** Sunny day — radiating lines from a warm circle. For "Nothing due today" empty state. */
export function IllustrationSunny() {
  return (
    <svg width="140" height="120" viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Radiating soft lines */}
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i * 30 * Math.PI) / 180;
        const x1 = 70 + Math.cos(angle) * 28;
        const y1 = 60 + Math.sin(angle) * 28;
        const x2 = 70 + Math.cos(angle) * 48;
        const y2 = 60 + Math.sin(angle) * 48;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--m-amber)" strokeWidth="2" opacity={0.15 + (i % 3) * 0.1} strokeLinecap="round" />;
      })}
      <circle cx="70" cy="60" r="24" fill="var(--m-amber)" opacity="0.15" />
      <circle cx="70" cy="60" r="16" fill="var(--m-amber)" opacity="0.25" />
      <circle cx="70" cy="60" r="8" fill="var(--m-accent)" opacity="0.3" />
    </svg>
  );
}

/** Folder stack — overlapping rounded rectangles. For "No projects" empty state. */
export function IllustrationFolders() {
  return (
    <svg width="140" height="120" viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="35" y="45" width="70" height="50" rx="10" fill="var(--m-amber)" opacity="0.12" />
      <rect x="42" y="38" width="62" height="48" rx="9" fill="var(--m-amber)" opacity="0.18" />
      <rect x="49" y="31" width="54" height="46" rx="8" fill="var(--m-accent)" opacity="0.15" />
      <circle cx="76" cy="54" r="10" fill="var(--m-amber)" opacity="0.3" />
      <path d="M72 54l3 3 5-6" stroke="var(--m-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
    </svg>
  );
}

/** Flowing waves — abstract curves. For custom screen empty states. */
export function IllustrationWaves() {
  return (
    <svg width="140" height="120" viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M0 80 C30 65, 50 85, 70 70 S110 55, 140 70" stroke="var(--m-amber)" strokeWidth="2.5" opacity="0.2" fill="none" />
      <path d="M0 90 C25 75, 55 95, 75 78 S115 65, 140 80" stroke="var(--m-accent)" strokeWidth="2" opacity="0.15" fill="none" />
      <path d="M0 70 C35 58, 45 78, 65 62 S105 48, 140 60" stroke="var(--m-amber)" strokeWidth="1.5" opacity="0.12" fill="none" />
      <circle cx="70" cy="45" r="18" fill="var(--m-amber)" opacity="0.1" />
      <circle cx="70" cy="45" r="10" fill="var(--m-accent)" opacity="0.12" />
    </svg>
  );
}

/** Construction — geometric shapes suggesting work in progress. For "coming soon" state. */
export function IllustrationConstruction() {
  return (
    <svg width="140" height="120" viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="40" y="50" width="60" height="40" rx="6" fill="var(--m-amber)" opacity="0.12" transform="rotate(-3 70 70)" />
      <rect x="50" y="40" width="45" height="35" rx="5" fill="var(--m-accent)" opacity="0.12" transform="rotate(5 72 57)" />
      <circle cx="70" cy="55" r="15" fill="var(--m-amber)" opacity="0.15" />
      <path d="M63 55h14M70 48v14" stroke="var(--m-accent)" strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}

/** Swipe gesture — horizontal arrow with motion lines. For onboarding step 1. */
export function IllustrationSwipe() {
  return (
    <svg width="160" height="120" viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="20" y="40" width="120" height="40" rx="12" fill="var(--m-amber)" opacity="0.1" />
      {/* Motion lines */}
      <line x1="35" y1="55" x2="55" y2="55" stroke="var(--m-amber)" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
      <line x1="40" y1="60" x2="50" y2="60" stroke="var(--m-amber)" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      <line x1="38" y1="65" x2="52" y2="65" stroke="var(--m-amber)" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      {/* Arrow */}
      <circle cx="100" cy="60" r="16" fill="var(--m-accent)" opacity="0.2" />
      <path d="M93 60h18M105 54l6 6-6 6" stroke="var(--m-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
    </svg>
  );
}

/** Plus burst — radiating from center plus. For onboarding step 2 (quick capture). */
export function IllustrationCapture() {
  return (
    <svg width="160" height="120" viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="80" cy="60" r="30" fill="var(--m-amber)" opacity="0.1" />
      <circle cx="80" cy="60" r="20" fill="var(--m-accent)" opacity="0.12" />
      {/* Radiating dots */}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i * 45 * Math.PI) / 180;
        const cx = 80 + Math.cos(angle) * 40;
        const cy = 60 + Math.sin(angle) * 40;
        return <circle key={i} cx={cx} cy={cy} r={3 + (i % 3)} fill={i % 2 === 0 ? "var(--m-amber)" : "var(--m-accent)"} opacity={0.15 + (i % 3) * 0.08} />;
      })}
      <path d="M74 60h12M80 54v12" stroke="var(--m-accent)" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

/** Tap ripple — concentric circles with a finger tap point. For onboarding step 3 (details). */
export function IllustrationTap() {
  return (
    <svg width="160" height="120" viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="80" cy="55" r="40" fill="var(--m-amber)" opacity="0.06" />
      <circle cx="80" cy="55" r="28" fill="var(--m-amber)" opacity="0.1" />
      <circle cx="80" cy="55" r="16" fill="var(--m-accent)" opacity="0.12" />
      <circle cx="80" cy="55" r="6" fill="var(--m-accent)" opacity="0.25" />
      {/* Upward arrow suggesting drag-up */}
      <path d="M80 85v16" stroke="var(--m-amber)" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
      <path d="M75 90l5-5 5 5" stroke="var(--m-amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.2" />
    </svg>
  );
}
