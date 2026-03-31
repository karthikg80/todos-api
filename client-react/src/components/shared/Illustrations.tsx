/**
 * Custom SVG illustrations for empty states and decorative elements.
 * Theme-aware via CSS custom properties (--border, --accent, --surface, --success, --muted).
 * All illustrations use a calm, minimal aesthetic matching Notion/Linear.
 */

/** Todo list empty — completed checkmark with floating elements */
export function IllustrationTasksEmpty() {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="illustration"
      aria-hidden="true"
    >
      {/* Floating card 1 */}
      <rect
        x="28"
        y="30"
        width="104"
        height="16"
        rx="8"
        fill="var(--border)"
        opacity="0.15"
      />
      <rect
        x="36"
        y="52"
        width="88"
        height="16"
        rx="8"
        fill="var(--border)"
        opacity="0.1"
      />
      <rect
        x="44"
        y="74"
        width="72"
        height="16"
        rx="8"
        fill="var(--border)"
        opacity="0.07"
      />
      {/* Checkmark circle */}
      <circle cx="80" cy="55" r="22" fill="var(--accent)" opacity="0.08" />
      <circle
        cx="80"
        cy="55"
        r="22"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        opacity="0.25"
      />
      <path
        d="M71 55l6 6 12-12"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />
      {/* Sparkles */}
      <circle cx="120" cy="28" r="2" fill="var(--accent)" opacity="0.2" />
      <circle cx="38" cy="42" r="1.5" fill="var(--accent)" opacity="0.15" />
      <circle cx="130" cy="70" r="1.5" fill="var(--success)" opacity="0.2" />
    </svg>
  );
}

/** Focus dashboard all clear — sunrise horizon */
export function IllustrationAllClear() {
  return (
    <svg
      viewBox="0 0 200 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="illustration"
      aria-hidden="true"
    >
      {/* Horizon line */}
      <line
        x1="20"
        y1="85"
        x2="180"
        y2="85"
        stroke="var(--border)"
        strokeWidth="1"
        opacity="0.3"
      />
      {/* Sun */}
      <circle cx="100" cy="65" r="18" fill="var(--accent)" opacity="0.08" />
      <circle
        cx="100"
        cy="65"
        r="18"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1"
        opacity="0.2"
      />
      {/* Sun rays */}
      <line
        x1="100"
        y1="40"
        x2="100"
        y2="34"
        stroke="var(--accent)"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.15"
      />
      <line
        x1="118"
        y1="47"
        x2="122"
        y2="43"
        stroke="var(--accent)"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.12"
      />
      <line
        x1="82"
        y1="47"
        x2="78"
        y2="43"
        stroke="var(--accent)"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.12"
      />
      {/* Ground elements */}
      <rect
        x="30"
        y="90"
        width="40"
        height="3"
        rx="1.5"
        fill="var(--border)"
        opacity="0.12"
      />
      <rect
        x="85"
        y="92"
        width="60"
        height="3"
        rx="1.5"
        fill="var(--border)"
        opacity="0.08"
      />
      <rect
        x="50"
        y="98"
        width="30"
        height="3"
        rx="1.5"
        fill="var(--border)"
        opacity="0.06"
      />
    </svg>
  );
}

/** Desk clear — inbox tray with sparkle */
export function IllustrationDeskClear() {
  return (
    <svg
      viewBox="0 0 140 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="illustration"
      aria-hidden="true"
    >
      {/* Tray */}
      <rect
        x="30"
        y="25"
        width="80"
        height="50"
        rx="8"
        fill="var(--surface)"
        stroke="var(--border)"
        strokeWidth="1.5"
      />
      {/* Tray divider */}
      <path
        d="M30 48h28l6 10h12l6-10h28"
        stroke="var(--border)"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Sparkle */}
      <path
        d="M108 22l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"
        fill="var(--success)"
        opacity="0.4"
      />
      <circle cx="116" cy="38" r="1.5" fill="var(--success)" opacity="0.2" />
      <circle cx="24" cy="35" r="1" fill="var(--accent)" opacity="0.15" />
    </svg>
  );
}

/** Nothing to sort — floating cards settled */
export function IllustrationSorted() {
  return (
    <svg
      viewBox="0 0 140 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="illustration"
      aria-hidden="true"
    >
      {/* Stack of cards (tidy) */}
      <rect
        x="35"
        y="35"
        width="70"
        height="40"
        rx="6"
        fill="var(--border)"
        opacity="0.08"
        stroke="var(--border)"
        strokeWidth="0.5"
      />
      <rect
        x="30"
        y="28"
        width="70"
        height="40"
        rx="6"
        fill="var(--surface)"
        stroke="var(--border)"
        strokeWidth="1.5"
      />
      {/* Check lines */}
      <path
        d="M42 42l3 3 6-6"
        stroke="var(--success)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />
      <rect
        x="56"
        y="41"
        width="32"
        height="2.5"
        rx="1.25"
        fill="var(--border)"
        opacity="0.25"
      />
      <path
        d="M42 54l3 3 6-6"
        stroke="var(--success)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.35"
      />
      <rect
        x="56"
        y="53"
        width="24"
        height="2.5"
        rx="1.25"
        fill="var(--border)"
        opacity="0.18"
      />
    </svg>
  );
}

/** Board column empty — dashed placeholder */
export function IllustrationBoardEmpty() {
  return (
    <svg
      viewBox="0 0 80 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="illustration illustration--sm"
      aria-hidden="true"
    >
      <rect
        x="10"
        y="8"
        width="60"
        height="44"
        rx="8"
        fill="none"
        stroke="var(--border)"
        strokeWidth="1"
        strokeDasharray="4 3"
        opacity="0.3"
      />
      <circle cx="40" cy="30" r="6" fill="var(--border)" opacity="0.1" />
      <path
        d="M37 30h6M40 27v6"
        stroke="var(--muted)"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.3"
      />
    </svg>
  );
}

/** No search results — magnifier with question */
export function IllustrationNoResults() {
  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="illustration"
      aria-hidden="true"
    >
      {/* Magnifier */}
      <circle
        cx="52"
        cy="36"
        r="18"
        fill="var(--surface)"
        stroke="var(--border)"
        strokeWidth="1.5"
      />
      <line
        x1="65"
        y1="49"
        x2="80"
        y2="64"
        stroke="var(--border)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Question mark */}
      <path
        d="M48 32a4 4 0 0 1 4-4 4 4 0 0 1 4 4c0 2-2 3-4 4"
        stroke="var(--muted)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
      <circle cx="52" cy="42" r="1" fill="var(--muted)" opacity="0.4" />
      {/* Floating dots */}
      <circle cx="90" cy="20" r="2" fill="var(--border)" opacity="0.15" />
      <circle cx="30" cy="60" r="1.5" fill="var(--border)" opacity="0.1" />
    </svg>
  );
}

/** AI thinking — brain with sparkles */
export function IllustrationAiThinking() {
  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="illustration"
      aria-hidden="true"
    >
      {/* Brain outline */}
      <path
        d="M60 20c-8 0-15 5-17 12-6 2-10 8-10 14 0 8 6 14 14 14h26c8 0 14-6 14-14 0-6-4-12-10-14-2-7-9-12-17-12z"
        fill="var(--accent)"
        opacity="0.06"
      />
      <path
        d="M60 20c-8 0-15 5-17 12-6 2-10 8-10 14 0 8 6 14 14 14h26c8 0 14-6 14-14 0-6-4-12-10-14-2-7-9-12-17-12z"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1"
        opacity="0.2"
      />
      {/* Sparkles */}
      <path
        d="M88 18l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5z"
        fill="var(--accent)"
        opacity="0.35"
      />
      <path
        d="M30 28l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"
        fill="var(--accent)"
        opacity="0.25"
      />
      <circle cx="95" cy="45" r="1.5" fill="var(--accent)" opacity="0.2" />
      <circle cx="25" cy="50" r="1" fill="var(--accent)" opacity="0.15" />
    </svg>
  );
}

/** Feedback empty — speech bubble */
export function IllustrationFeedbackEmpty() {
  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="illustration"
      aria-hidden="true"
    >
      <path
        d="M30 20h60a8 8 0 0 1 8 8v24a8 8 0 0 1-8 8H50l-12 10V60H30a8 8 0 0 1-8-8V28a8 8 0 0 1 8-8z"
        fill="var(--surface)"
        stroke="var(--border)"
        strokeWidth="1.5"
      />
      {/* Lines */}
      <rect
        x="38"
        y="32"
        width="44"
        height="3"
        rx="1.5"
        fill="var(--border)"
        opacity="0.2"
      />
      <rect
        x="38"
        y="40"
        width="32"
        height="3"
        rx="1.5"
        fill="var(--border)"
        opacity="0.15"
      />
      <rect
        x="38"
        y="48"
        width="20"
        height="3"
        rx="1.5"
        fill="var(--border)"
        opacity="0.1"
      />
    </svg>
  );
}
