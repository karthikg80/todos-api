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

// ─── Tier 2: View-specific filter empty states ────────────────────────────

/**
 * Sunny day with a checkmark cloud — "all caught up for today."
 * Used for the Today view zero-task state.
 */
export function illustrationTodayClear() {
  return `<svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" class="empty-state-illustration" aria-hidden="true">
  <!-- Sun -->
  <circle cx="160" cy="36" r="20" fill="var(--warning)" opacity="0.7"/>
  <!-- Small rays -->
  <line x1="160" y1="8" x2="160" y2="16" stroke="var(--warning)" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
  <line x1="184" y1="36" x2="180" y2="36" stroke="var(--warning)" stroke-width="2" stroke-linecap="round" opacity="0.25"/>
  <line x1="178" y1="18" x2="174" y2="22" stroke="var(--warning)" stroke-width="2" stroke-linecap="round" opacity="0.2"/>
  <line x1="142" y1="18" x2="146" y2="22" stroke="var(--warning)" stroke-width="2" stroke-linecap="round" opacity="0.2"/>
  <!-- Cloud -->
  <ellipse cx="90" cy="72" rx="44" ry="22" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <ellipse cx="72" cy="60" rx="20" ry="16" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <ellipse cx="108" cy="56" rx="24" ry="18" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <!-- Cloud fill to clean up strokes -->
  <ellipse cx="90" cy="68" rx="38" ry="18" fill="var(--surface)"/>
  <!-- Checkmark in cloud -->
  <path d="M80 68l7 7 16-16" stroke="var(--success)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Ground line -->
  <rect x="24" y="116" width="152" height="2" rx="1" fill="var(--border)" opacity="0.3"/>
  <!-- Small grass tufts -->
  <path d="M50 116c0-6 3-10 3-10s3 4 3 10" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" opacity="0.3"/>
  <path d="M140 116c0-5 2-8 2-8s2 3 2 8" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" opacity="0.25"/>
</svg>`;
}

/**
 * Calendar page with a calm horizon — forward-looking emptiness.
 * Used for the Upcoming view zero-task state.
 */
export function illustrationUpcomingEmpty() {
  return `<svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" class="empty-state-illustration" aria-hidden="true">
  <!-- Calendar page -->
  <rect x="55" y="36" width="90" height="80" rx="8" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <!-- Calendar header bar -->
  <rect x="55" y="36" width="90" height="20" rx="8" fill="var(--accent)" opacity="0.12"/>
  <rect x="55" y="48" width="90" height="8" fill="var(--accent)" opacity="0.12"/>
  <!-- Binding rings -->
  <circle cx="78" cy="36" r="4" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <circle cx="122" cy="36" r="4" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <!-- Blank date grid dots -->
  <circle cx="74" cy="72" r="2.5" fill="var(--border)" opacity="0.2"/>
  <circle cx="92" cy="72" r="2.5" fill="var(--border)" opacity="0.2"/>
  <circle cx="110" cy="72" r="2.5" fill="var(--border)" opacity="0.2"/>
  <circle cx="128" cy="72" r="2.5" fill="var(--border)" opacity="0.2"/>
  <circle cx="74" cy="88" r="2.5" fill="var(--border)" opacity="0.15"/>
  <circle cx="92" cy="88" r="2.5" fill="var(--border)" opacity="0.15"/>
  <circle cx="110" cy="88" r="2.5" fill="var(--border)" opacity="0.15"/>
  <circle cx="128" cy="88" r="2.5" fill="var(--border)" opacity="0.15"/>
  <circle cx="74" cy="104" r="2.5" fill="var(--border)" opacity="0.1"/>
  <circle cx="92" cy="104" r="2.5" fill="var(--border)" opacity="0.1"/>
  <!-- Horizon accent -->
  <rect x="20" y="128" width="160" height="2" rx="1" fill="var(--border)" opacity="0.25"/>
</svg>`;
}

/**
 * Trophy/ribbon with a progress arc — "nothing completed yet" encouragement.
 * Used for the Completed view zero-task state.
 */
export function illustrationCompletedEmpty() {
  return `<svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" class="empty-state-illustration" aria-hidden="true">
  <!-- Trophy cup -->
  <rect x="76" y="48" width="48" height="44" rx="6" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <!-- Trophy handles -->
  <path d="M76 58c-10 0-16 6-16 14s6 14 14 14h2" stroke="var(--border)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <path d="M124 58c10 0 16 6 16 14s-6 14-14 14h-2" stroke="var(--border)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <!-- Trophy base -->
  <rect x="88" y="92" width="24" height="6" rx="2" fill="var(--border)" opacity="0.35"/>
  <rect x="82" y="98" width="36" height="8" rx="3" fill="var(--border)" opacity="0.25"/>
  <!-- Star inside trophy -->
  <path d="M100 58l3 6.5 7 1-5 5 1.2 7-6.2-3.3-6.2 3.3 1.2-7-5-5 7-1z" fill="var(--warning)" opacity="0.5"/>
  <!-- Progress arc (empty) -->
  <path d="M58 30 A50 50 0 0 1 142 30" stroke="var(--border)" stroke-width="2" stroke-linecap="round" stroke-dasharray="6 4" fill="none" opacity="0.2"/>
  <!-- Sparkle hints -->
  <circle cx="52" cy="44" r="2" fill="var(--accent)" opacity="0.2"/>
  <circle cx="150" cy="42" r="1.5" fill="var(--accent)" opacity="0.15"/>
</svg>`;
}

/**
 * Floating thought bubble / cloud — dreamy "someday" feeling.
 * Used for the Someday view zero-task state.
 */
export function illustrationSomedayEmpty() {
  return `<svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" class="empty-state-illustration" aria-hidden="true">
  <!-- Main thought bubble -->
  <ellipse cx="100" cy="58" rx="52" ry="32" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <!-- Thought trail -->
  <circle cx="62" cy="104" r="8" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <circle cx="48" cy="118" r="5" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <!-- Dreamy stars inside bubble -->
  <path d="M82 52l2 4 4 .8-3 3 .7 4.2-3.7-2-3.7 2 .7-4.2-3-3 4-.8z" fill="var(--accent)" opacity="0.2"/>
  <path d="M110 48l1.5 3 3.5 .5-2.5 2.5.6 3.5-3.1-1.6-3.1 1.6.6-3.5-2.5-2.5 3.5-.5z" fill="var(--accent)" opacity="0.15"/>
  <path d="M96 68l1 2 2.5.4-1.8 1.8.4 2.5-2.1-1.1-2.1 1.1.4-2.5-1.8-1.8 2.5-.4z" fill="var(--accent)" opacity="0.12"/>
  <!-- Ellipsis inside bubble -->
  <circle cx="88" cy="58" r="3" fill="var(--border)" opacity="0.25"/>
  <circle cx="100" cy="58" r="3" fill="var(--border)" opacity="0.25"/>
  <circle cx="112" cy="58" r="3" fill="var(--border)" opacity="0.25"/>
</svg>`;
}

// ─── Tier 2: Feature-area empty states ────────────────────────────────────

/**
 * Clipboard with a sparkle wand — weekly review / reflection.
 * Used for the Weekly Review "nothing to clean up" state.
 */
export function illustrationWeeklyReviewClean() {
  return `<svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" class="empty-state-illustration" aria-hidden="true">
  <!-- Clipboard -->
  <rect x="60" y="36" width="72" height="88" rx="8" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <rect x="82" y="30" width="28" height="10" rx="4" fill="var(--accent)" opacity="0.7"/>
  <!-- Checked rows -->
  <path d="M74 58l4 4 8-8" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
  <rect x="92" y="56" width="30" height="3" rx="1.5" fill="var(--border)" opacity="0.3"/>
  <path d="M74 76l4 4 8-8" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
  <rect x="92" y="74" width="26" height="3" rx="1.5" fill="var(--border)" opacity="0.25"/>
  <path d="M74 94l4 4 8-8" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/>
  <rect x="92" y="92" width="22" height="3" rx="1.5" fill="var(--border)" opacity="0.2"/>
  <!-- Sparkle wand -->
  <line x1="148" y1="30" x2="136" y2="68" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M148 26l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="var(--accent)" opacity="0.7"/>
  <circle cx="155" cy="44" r="2" fill="var(--accent)" opacity="0.3"/>
  <circle cx="142" cy="20" r="1.5" fill="var(--accent)" opacity="0.25"/>
</svg>`;
}

/**
 * Broom sweeping sparkles — cleanup analysis found nothing.
 * Used for the Cleanup "no issues" state.
 */
export function illustrationCleanupClear() {
  return `<svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" class="empty-state-illustration" aria-hidden="true">
  <!-- Broom handle -->
  <line x1="85" y1="20" x2="105" y2="90" stroke="var(--border)" stroke-width="3" stroke-linecap="round"/>
  <!-- Broom head -->
  <path d="M90 90 Q88 110 78 120 L132 120 Q122 110 120 90 Z" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round"/>
  <!-- Bristle lines -->
  <line x1="90" y1="100" x2="85" y2="118" stroke="var(--accent)" stroke-width="1" opacity="0.3"/>
  <line x1="100" y1="98" x2="100" y2="118" stroke="var(--accent)" stroke-width="1" opacity="0.3"/>
  <line x1="110" y1="100" x2="115" y2="118" stroke="var(--accent)" stroke-width="1" opacity="0.3"/>
  <!-- Sparkles (cleanliness) -->
  <path d="M140 40l2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2z" fill="var(--success)" opacity="0.5"/>
  <path d="M56 52l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5z" fill="var(--success)" opacity="0.35"/>
  <circle cx="150" cy="64" r="2" fill="var(--success)" opacity="0.25"/>
  <circle cx="48" cy="38" r="1.5" fill="var(--success)" opacity="0.2"/>
  <!-- Ground line -->
  <rect x="40" y="124" width="120" height="1.5" rx="0.75" fill="var(--border)" opacity="0.2"/>
</svg>`;
}

/**
 * Small lightbulb — AI has no suggestions right now.
 * Used for AI suggestion empty states in the task drawer.
 */
export function illustrationAiEmpty() {
  return `<svg viewBox="0 0 48 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="empty-state-illustration empty-state-illustration--micro" aria-hidden="true">
  <!-- Bulb -->
  <circle cx="24" cy="16" r="10" fill="var(--surface)" stroke="var(--accent)" stroke-width="1.5"/>
  <!-- Filament glow -->
  <circle cx="24" cy="16" r="5" fill="var(--accent)" opacity="0.06"/>
  <!-- Filament -->
  <path d="M22 14c0-2 1-3 2-3s2 1 2 3" stroke="var(--accent)" stroke-width="1" stroke-linecap="round" opacity="0.4"/>
  <!-- Base -->
  <rect x="21" y="26" width="6" height="4" rx="1" fill="var(--border)" opacity="0.4"/>
  <rect x="22" y="30" width="4" height="2" rx="1" fill="var(--border)" opacity="0.3"/>
  <!-- Subtle rays (dimmed = no suggestion) -->
  <line x1="24" y1="2" x2="24" y2="4" stroke="var(--accent)" stroke-width="1" stroke-linecap="round" opacity="0.15"/>
  <line x1="36" y1="16" x2="34" y2="16" stroke="var(--accent)" stroke-width="1" stroke-linecap="round" opacity="0.12"/>
  <line x1="12" y1="16" x2="14" y2="16" stroke="var(--accent)" stroke-width="1" stroke-linecap="round" opacity="0.12"/>
</svg>`;
}

/**
 * Small command line prompt — command palette has no matches.
 * Used for the Command Palette empty state.
 */
export function illustrationCommandEmpty() {
  return `<svg viewBox="0 0 48 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="empty-state-illustration empty-state-illustration--micro" aria-hidden="true">
  <!-- Terminal window -->
  <rect x="6" y="6" width="36" height="28" rx="4" fill="var(--surface)" stroke="var(--border)" stroke-width="1.2"/>
  <!-- Title bar dots -->
  <circle cx="13" cy="12" r="1.5" fill="var(--border)" opacity="0.4"/>
  <circle cx="18" cy="12" r="1.5" fill="var(--border)" opacity="0.4"/>
  <circle cx="23" cy="12" r="1.5" fill="var(--border)" opacity="0.4"/>
  <!-- Prompt line -->
  <path d="M12 22l3 3-3 3" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
  <!-- Blinking cursor -->
  <rect x="20" y="23" width="1.5" height="5" rx="0.5" fill="var(--accent)" opacity="0.35"/>
  <!-- Faded placeholder text -->
  <rect x="24" y="24" width="12" height="2" rx="1" fill="var(--border)" opacity="0.15"/>
</svg>`;
}

// ─── Tier 3: Micro-illustrations for small inline contexts ────────────────

/**
 * Tiny checklist — subtasks area is empty.
 * Used for the "No subtasks" drawer state.
 */
export function illustrationSubtasksEmpty() {
  return `<svg viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg" class="empty-state-illustration empty-state-illustration--inline" aria-hidden="true">
  <circle cx="8" cy="7" r="3" fill="none" stroke="var(--border)" stroke-width="1" opacity="0.4"/>
  <rect x="14" y="5.5" width="16" height="2.5" rx="1.25" fill="var(--border)" opacity="0.25"/>
  <circle cx="8" cy="17" r="3" fill="none" stroke="var(--border)" stroke-width="1" opacity="0.3"/>
  <rect x="14" y="15.5" width="12" height="2.5" rx="1.25" fill="var(--border)" opacity="0.18"/>
</svg>`;
}

/**
 * Tiny magnifier — task picker search has no results.
 * Used for the task picker dropdown empty state.
 */
export function illustrationPickerEmpty() {
  return `<svg viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg" class="empty-state-illustration empty-state-illustration--inline" aria-hidden="true">
  <circle cx="15" cy="12" r="7" fill="none" stroke="var(--border)" stroke-width="1.2" opacity="0.4"/>
  <line x1="20" y1="17" x2="26" y2="23" stroke="var(--border)" stroke-width="1.5" stroke-linecap="round" opacity="0.35"/>
  <!-- X inside lens -->
  <line x1="12.5" y1="9.5" x2="17.5" y2="14.5" stroke="var(--border)" stroke-width="1" stroke-linecap="round" opacity="0.2"/>
  <line x1="17.5" y1="9.5" x2="12.5" y2="14.5" stroke="var(--border)" stroke-width="1" stroke-linecap="round" opacity="0.2"/>
</svg>`;
}

/**
 * Small horizontal bar chart — home tile has no data.
 * Used for home dashboard tile empty states.
 */
export function illustrationTileEmpty() {
  return `<svg viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg" class="empty-state-illustration empty-state-illustration--inline" aria-hidden="true">
  <rect x="4" y="6" width="18" height="3" rx="1.5" fill="var(--border)" opacity="0.2"/>
  <rect x="4" y="12.5" width="14" height="3" rx="1.5" fill="var(--border)" opacity="0.15"/>
  <rect x="4" y="19" width="10" height="3" rx="1.5" fill="var(--border)" opacity="0.1"/>
</svg>`;
}

/**
 * Small folder with a checkmark — project hotspots tile is quiet.
 * Used for the "Projects to Nudge" home tile empty state.
 */
export function illustrationProjectsQuiet() {
  return `<svg viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg" class="empty-state-illustration empty-state-illustration--inline" aria-hidden="true">
  <!-- Folder -->
  <rect x="4" y="10" width="24" height="14" rx="2" fill="var(--surface)" stroke="var(--border)" stroke-width="1" opacity="0.5"/>
  <!-- Folder tab -->
  <path d="M4 10 L4 8 Q4 6 6 6 L12 6 L14 10" fill="var(--surface)" stroke="var(--border)" stroke-width="1" stroke-linejoin="round" opacity="0.5"/>
  <!-- Checkmark -->
  <path d="M12 17l3 3 6-6" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/>
</svg>`;
}

/**
 * Small warning triangle — plan had an error but it's ok.
 * Used for the "Could not load plan" tile error state.
 */
export function illustrationPlanError() {
  return `<svg viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg" class="empty-state-illustration empty-state-illustration--inline" aria-hidden="true">
  <!-- Triangle outline -->
  <path d="M18 5 L30 23 L6 23 Z" fill="none" stroke="var(--warning)" stroke-width="1.2" stroke-linejoin="round" opacity="0.5"/>
  <!-- Exclamation -->
  <line x1="18" y1="11" x2="18" y2="17" stroke="var(--warning)" stroke-width="1.5" stroke-linecap="round" opacity="0.45"/>
  <circle cx="18" cy="20" r="1" fill="var(--warning)" opacity="0.45"/>
</svg>`;
}

/**
 * Small list with dashes — weekly review section has nothing.
 * Used for empty sections within the weekly review findings.
 */
export function illustrationWrSectionEmpty() {
  return `<svg viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg" class="empty-state-illustration empty-state-illustration--inline" aria-hidden="true">
  <!-- Dashes representing empty rows -->
  <rect x="6" y="7" width="10" height="2" rx="1" fill="var(--border)" opacity="0.2"/>
  <rect x="18" y="7" width="6" height="2" rx="1" fill="var(--border)" opacity="0.12"/>
  <rect x="6" y="13" width="8" height="2" rx="1" fill="var(--border)" opacity="0.15"/>
  <rect x="16" y="13" width="8" height="2" rx="1" fill="var(--border)" opacity="0.1"/>
  <rect x="6" y="19" width="12" height="2" rx="1" fill="var(--border)" opacity="0.1"/>
</svg>`;
}

// ─── Home tile-specific illustrations ─────────────────────────────────────

/**
 * Calm clock face with hands at rest — nothing urgent on the horizon.
 * Used for the "Due soon" home tile empty state.
 */
export function illustrationDueSoonEmpty() {
  return `<svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" class="empty-state-illustration empty-state-illustration--tile" aria-hidden="true">
  <!-- Clock face -->
  <circle cx="60" cy="40" r="28" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <!-- Hour markers -->
  <circle cx="60" cy="15" r="1.5" fill="var(--border)" opacity="0.4"/>
  <circle cx="85" cy="40" r="1.5" fill="var(--border)" opacity="0.4"/>
  <circle cx="60" cy="65" r="1.5" fill="var(--border)" opacity="0.4"/>
  <circle cx="35" cy="40" r="1.5" fill="var(--border)" opacity="0.4"/>
  <!-- Subtle minor markers -->
  <circle cx="74" cy="19" r="1" fill="var(--border)" opacity="0.2"/>
  <circle cx="81" cy="28" r="1" fill="var(--border)" opacity="0.2"/>
  <circle cx="81" cy="52" r="1" fill="var(--border)" opacity="0.2"/>
  <circle cx="74" cy="61" r="1" fill="var(--border)" opacity="0.2"/>
  <circle cx="46" cy="61" r="1" fill="var(--border)" opacity="0.2"/>
  <circle cx="39" cy="52" r="1" fill="var(--border)" opacity="0.2"/>
  <circle cx="39" cy="28" r="1" fill="var(--border)" opacity="0.2"/>
  <circle cx="46" cy="19" r="1" fill="var(--border)" opacity="0.2"/>
  <!-- Hour hand (pointing ~10 o'clock — relaxed) -->
  <line x1="60" y1="40" x2="50" y2="24" stroke="var(--border)" stroke-width="2.5" stroke-linecap="round" opacity="0.5"/>
  <!-- Minute hand -->
  <line x1="60" y1="40" x2="60" y2="18" stroke="var(--border)" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
  <!-- Center dot -->
  <circle cx="60" cy="40" r="2.5" fill="var(--accent)" opacity="0.5"/>
  <!-- Checkmark accent — all clear -->
  <circle cx="96" cy="16" r="10" fill="var(--success)" opacity="0.08"/>
  <circle cx="96" cy="16" r="10" fill="none" stroke="var(--success)" stroke-width="1.2" opacity="0.4"/>
  <path d="M91 16l3.5 3.5 7-7" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
</svg>`;
}

/**
 * Tidy stack of cards with a sparkle — backlog is clean.
 * Used for the "Backlog hygiene" home tile empty state.
 */
export function illustrationBacklogCleanEmpty() {
  return `<svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" class="empty-state-illustration empty-state-illustration--tile" aria-hidden="true">
  <!-- Bottom card (offset) -->
  <rect x="28" y="32" width="64" height="40" rx="6" fill="var(--border)" opacity="0.1" stroke="var(--border)" stroke-width="1"/>
  <!-- Middle card (slightly offset) -->
  <rect x="24" y="26" width="64" height="40" rx="6" fill="var(--border)" opacity="0.06" stroke="var(--border)" stroke-width="1"/>
  <!-- Top card -->
  <rect x="20" y="20" width="64" height="40" rx="6" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <!-- Tidy check lines on top card -->
  <path d="M32 34l3 3 6-6" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/>
  <rect x="46" y="33" width="28" height="2.5" rx="1.25" fill="var(--border)" opacity="0.25"/>
  <path d="M32 46l3 3 6-6" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.35"/>
  <rect x="46" y="45" width="22" height="2.5" rx="1.25" fill="var(--border)" opacity="0.18"/>
  <!-- Sparkle — clean feeling -->
  <path d="M98 22l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="var(--success)" opacity="0.4"/>
  <circle cx="104" cy="38" r="1.5" fill="var(--success)" opacity="0.2"/>
  <circle cx="94" cy="14" r="1.5" fill="var(--success)" opacity="0.15"/>
</svg>`;
}
