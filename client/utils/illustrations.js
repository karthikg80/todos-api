// illustrations.js — Inline SVG empty-state illustrations.
// Each function returns an SVG string that uses CSS custom properties for
// automatic light/dark theming. Designed at 200×160 viewBox, rendered at
// whatever size the container dictates.

/**
 * Clipboard with placeholder lines and sparkle accents.
 * Used for the "No tasks yet" global empty state.
 */
export function illustrationNoTasks() {
  return `<svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" class="empty-state-illustration" aria-hidden="true">
  <!-- Clipboard body -->
  <rect x="60" y="40" width="80" height="100" rx="10" fill="var(--surface)" stroke="var(--border)" stroke-width="2"/>
  <!-- Clip tab -->
  <rect x="85" y="33" width="30" height="12" rx="4" fill="var(--accent)"/>
  <!-- Task lines -->
  <circle cx="77" cy="68" r="5" fill="none" stroke="var(--border)" stroke-width="1.5"/>
  <rect x="88" y="66" width="40" height="4" rx="2" fill="var(--border)" opacity="0.6"/>
  <circle cx="77" cy="88" r="5" fill="none" stroke="var(--border)" stroke-width="1.5"/>
  <rect x="88" y="86" width="36" height="4" rx="2" fill="var(--border)" opacity="0.5"/>
  <circle cx="77" cy="108" r="5" fill="none" stroke="var(--border)" stroke-width="1.5"/>
  <rect x="88" y="106" width="28" height="4" rx="2" fill="var(--border)" opacity="0.35"/>
  <!-- Sparkle star -->
  <path d="M152 38l2.5 5.5 5.5 2.5-5.5 2.5-2.5 5.5-2.5-5.5-5.5-2.5 5.5-2.5z" fill="var(--accent)" opacity="0.8"/>
  <!-- Small sparkle dots -->
  <circle cx="160" cy="56" r="2.5" fill="var(--accent)" opacity="0.4"/>
  <circle cx="140" cy="58" r="1.5" fill="var(--accent)" opacity="0.3"/>
</svg>`;
}

/**
 * Sunrise over a gentle horizon with soft rays.
 * Used for the "Welcome to your workspace" home empty state.
 */
export function illustrationWelcome() {
  return `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" class="empty-state-illustration" aria-hidden="true">
  <defs>
    <clipPath id="horizon-clip"><rect x="0" y="0" width="200" height="118"/></clipPath>
  </defs>
  <g clip-path="url(#horizon-clip)">
    <!-- Sun glow -->
    <circle cx="100" cy="105" r="40" fill="var(--warning)" opacity="0.08"/>
    <!-- Sun -->
    <circle cx="100" cy="105" r="22" fill="var(--warning)" opacity="0.85"/>
    <!-- Rays -->
    <line x1="100" y1="55" x2="100" y2="70" stroke="var(--warning)" stroke-width="2" stroke-linecap="round" opacity="0.35"/>
    <line x1="72" y1="65" x2="80" y2="78" stroke="var(--warning)" stroke-width="2" stroke-linecap="round" opacity="0.25"/>
    <line x1="128" y1="65" x2="120" y2="78" stroke="var(--warning)" stroke-width="2" stroke-linecap="round" opacity="0.25"/>
    <line x1="55" y1="85" x2="68" y2="92" stroke="var(--warning)" stroke-width="2" stroke-linecap="round" opacity="0.2"/>
    <line x1="145" y1="85" x2="132" y2="92" stroke="var(--warning)" stroke-width="2" stroke-linecap="round" opacity="0.2"/>
    <!-- Hills -->
    <ellipse cx="60" cy="118" rx="55" ry="16" fill="var(--border)" opacity="0.3"/>
    <ellipse cx="150" cy="120" rx="50" ry="13" fill="var(--border)" opacity="0.25"/>
  </g>
  <!-- Horizon line -->
  <rect x="20" y="117" width="160" height="2" rx="1" fill="var(--border)" opacity="0.6"/>
</svg>`;
}

/**
 * Open inbox tray with a checkmark — satisfaction of zero inbox.
 * Used for the "Inbox is clear" empty state.
 */
export function illustrationInboxClear() {
  return `<svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" class="empty-state-illustration" aria-hidden="true">
  <!-- Tray body -->
  <rect x="55" y="80" width="90" height="50" rx="6" fill="var(--surface)" stroke="var(--border)" stroke-width="2"/>
  <!-- Tray walls -->
  <line x1="55" y1="80" x2="45" y2="60" stroke="var(--border)" stroke-width="2" stroke-linecap="round"/>
  <line x1="145" y1="80" x2="155" y2="60" stroke="var(--border)" stroke-width="2" stroke-linecap="round"/>
  <!-- Tray lip -->
  <line x1="45" y1="60" x2="155" y2="60" stroke="var(--border)" stroke-width="2" stroke-linecap="round"/>
  <!-- Check circle -->
  <circle cx="100" cy="40" r="18" fill="none" stroke="var(--success)" stroke-width="2" opacity="0.9"/>
  <circle cx="100" cy="40" r="18" fill="var(--success)" opacity="0.08"/>
  <!-- Checkmark -->
  <path d="M91 40l6 6 12-12" stroke="var(--success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Sparkle dots -->
  <circle cx="76" cy="30" r="2" fill="var(--success)" opacity="0.25"/>
  <circle cx="126" cy="34" r="2.5" fill="var(--success)" opacity="0.2"/>
  <circle cx="120" cy="24" r="1.5" fill="var(--success)" opacity="0.3"/>
</svg>`;
}

/**
 * Magnifying glass over a dashed empty area.
 * Used for "No matching tasks" filter-empty states.
 */
export function illustrationNoMatches() {
  return `<svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" class="empty-state-illustration" aria-hidden="true">
  <!-- Dashed placeholder area -->
  <rect x="35" y="65" width="90" height="75" rx="8" fill="var(--border)" opacity="0.08" stroke="var(--border)" stroke-width="1.5" stroke-dasharray="5 4"/>
  <!-- Empty rows -->
  <rect x="50" y="82" width="55" height="4" rx="2" fill="var(--border)" opacity="0.25"/>
  <rect x="50" y="96" width="45" height="4" rx="2" fill="var(--border)" opacity="0.2"/>
  <rect x="50" y="110" width="35" height="4" rx="2" fill="var(--border)" opacity="0.15"/>
  <!-- Magnifying glass lens -->
  <circle cx="130" cy="60" r="28" fill="var(--surface)" opacity="0.85" stroke="var(--accent)" stroke-width="3"/>
  <!-- Lens glare -->
  <circle cx="122" cy="50" r="4" fill="var(--accent)" opacity="0.12"/>
  <!-- Handle -->
  <line x1="150" y1="82" x2="164" y2="96" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/>
  <!-- Subtle question hint inside lens -->
  <text x="125" y="68" font-family="Inter, sans-serif" font-size="20" font-weight="600" fill="var(--accent)" opacity="0.18" text-anchor="middle">?</text>
</svg>`;
}

/**
 * Seedling sprouting from a pot — potential and growth.
 * Used for empty project states.
 */
export function illustrationEmptyProject() {
  return `<svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" class="empty-state-illustration" aria-hidden="true">
  <!-- Pot -->
  <rect x="72" y="100" width="56" height="40" rx="6" fill="var(--border)" opacity="0.3" stroke="var(--border)" stroke-width="1.5"/>
  <!-- Pot rim -->
  <rect x="66" y="94" width="68" height="10" rx="4" fill="var(--border)" opacity="0.45"/>
  <!-- Soil -->
  <rect x="78" y="106" width="44" height="5" rx="2.5" fill="var(--text-muted)" opacity="0.2"/>
  <!-- Stem -->
  <path d="M100 94 C100 72 100 58 100 50" stroke="var(--success)" stroke-width="3" stroke-linecap="round"/>
  <!-- Left leaf -->
  <ellipse cx="88" cy="68" rx="12" ry="6" transform="rotate(-20 88 68)" fill="var(--success)" opacity="0.6"/>
  <!-- Right leaf -->
  <ellipse cx="114" cy="54" rx="14" ry="7" transform="rotate(15 114 54)" fill="var(--success)" opacity="0.75"/>
  <!-- Bud -->
  <circle cx="100" cy="47" r="4" fill="var(--success)"/>
  <!-- Growth sparkles -->
  <circle cx="128" cy="42" r="2" fill="var(--accent)" opacity="0.25"/>
  <circle cx="74" cy="50" r="1.5" fill="var(--accent)" opacity="0.2"/>
  <circle cx="132" cy="56" r="1.5" fill="var(--accent)" opacity="0.15"/>
</svg>`;
}
