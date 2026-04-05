# Mobile Focus Tab — Tarot Card Carousel

## Goal

Rewrite the mobile Focus tab to display the same tarot card design as the desktop Focus dashboard, presented one card at a time in a swipeable carousel with flip-to-reveal provenance.

## Context

The desktop Focus dashboard (`HomeDashboard.tsx`) renders tarot-style cards (FlipCard + TarotCardFront/TarotCardBack) in a 2-column grid, fed by `useFocusBrief()`. The mobile `FocusScreen.tsx` currently shows a separate, simpler dashboard with greeting, stats, and task lists — it does not use the tarot card system or the focus brief API.

This spec brings the mobile Focus tab in line with the desktop design, adapted for single-card navigation via horizontal swipe.

## Layout

### Screen Structure

```
┌─────────────────────────┐
│  MobileHeader           │  ← greeting + task count
│  "Good morning"         │
│  "5 tasks · 1 overdue"  │
├─────────────────────────┤
│                         │
│   ┌─────────────────┐   │
│   │  Tarot Card     │   │
│   │  (one at a time)│   │
│   │                 │   │
│   │                 │   │
│   │           ◺     │   │  ← dog-ear flip trigger (36px)
│   └─────────────────┘   │
│                         │
│       ● ○ ○ ○ ○         │  ← dot pagination
├─────────────────────────┤
│  ☀  📅  +  📁  ☰       │  ← tab bar
└─────────────────────────┘
```

### Card Order

Same as desktop — pinned cards first, then AI-ranked panels:

1. RightNowPanel (The Flame, pinned)
2. TodayAgendaPanel (The Dawn, pinned)
3. rankedPanels[0..N] via PanelRenderer (The Hourglass, The Compass, The Inbox, etc.)

Panels that conditionally return null (e.g., RescueMode when thresholds aren't met) are filtered out before building the card array. The carousel never receives empty slides.

### Card Sizing

All mobile cards use the same height — no hero/competing distinction.

```css
--m-header-h: 52px;
--m-dots-h: 32px;
--m-tabbar-h: 56px;
--m-safe-b: env(safe-area-inset-bottom, 0px);
--m-card-gap: 24px;

height: calc(
  100dvh
  - var(--m-header-h)
  - var(--m-dots-h)
  - var(--m-tabbar-h)
  - var(--m-safe-b)
  - var(--m-card-gap)
);
```

`100dvh` is used everywhere (no `100vh`) to avoid iOS Safari address bar issues. Each component of the formula is a named token so the calculation adapts if any region changes height. Safe-area inset is explicit.

Card width is `100%` of the carousel container. The shell's `padding-inline` controls the horizontal inset.

## Gestures

### Swipe Navigation

- Swipe left → next card
- Swipe right → previous card
- CSS `translateX` transition (300ms ease) for snap animation
- Commit threshold: ~50px horizontal distance
- Velocity-aware: quick flicks below threshold still commit if velocity exceeds ~0.3px/ms
- Partial drag shows real-time card position (no transition during active drag)

### Flip (Dog-ear)

- Tap the dog-ear corner to flip the card, revealing provenance on the back
- Tap again to flip back to front
- Dog-ear enlarged to 36px on mobile (28px on desktop) for better touch targets
- Same 3D CSS flip animation as desktop (0.6s ease, `perspective: 1000px`, `backface-visibility: hidden`)

### Gesture Interaction Rules

- **Swipe while flipped: blocked.** Horizontal swipe is ignored while a card is in its flipped state. The user must tap the dog-ear to unflip first, then swipe. This avoids the jarring two-state-change problem of auto-unflip + slide in a single gesture.
- **Edge of deck:** Rubber-band resistance when swiping past first or last card. Drag distance reduced by ~60% beyond boundary. Snaps back on release.
- **Single card:** Hide dot indicator. Allow drag with elastic resistance (rubber-band feel) but no page change. Communicates "this is the only card" without disabling touch entirely.

## Core Decision: FlipCard State Ownership

The carousel must control flip state to enforce the invariant: swiping is blocked while a card is flipped. FlipCard currently manages its own `flipped` state internally. The carousel needs to override this.

### Approach: Controlled/Uncontrolled Dual Mode

```typescript
interface FlipCardProps {
  front: ReactNode;
  back: ReactNode;
  flipped?: boolean;                    // controlled mode
  onFlipChange?: (flipped: boolean) => void;  // notify parent
  className?: string;
}
```

- **Uncontrolled (default):** Omit `flipped`/`onFlipChange` — FlipCard manages its own state internally. Desktop keeps working unchanged.
- **Controlled (carousel):** Pass both props. CardCarousel holds a `flippedIndex: number | null` state. When a card's dog-ear is tapped, the carousel updates `flippedIndex`. When the user tries to swipe while `flippedIndex !== null`, the swipe gesture is ignored.

## Component Architecture

### Component Tree

```
FocusScreen                     ← mobile/screens/ (rewrite)
  ├── MobileHeader              ← existing, unchanged
  ├── CardCarousel              ← NEW: mobile/components/
  │   ├── useSwipeNavigation    ← NEW: mobile/hooks/
  │   ├── RightNowPanel         ← reused from components/home/
  │   ├── TodayAgendaPanel      ← reused from components/home/
  │   └── PanelRenderer × N     ← reused from components/home/
  └── DotIndicator              ← NEW: mobile/components/
```

### Data Flow

1. `FocusScreen` calls `useFocusBrief()` to get the structured brief data.
2. `FocusScreen` assembles a `ReactNode[]` array: [RightNowPanel, TodayAgendaPanel, ...rankedPanels via PanelRenderer], filtering out any that return null.
3. `CardCarousel` receives children as an array, manages `activeIndex` + `flippedIndex` + touch state, renders one card at a time with `translateX` offset.
4. `DotIndicator` receives `count` and `activeIndex`, renders pagination.
5. Task taps inside cards open the existing mobile bottom sheet via `onTodoClick`.

### New Files

| File | Purpose |
|------|---------|
| `mobile/components/CardCarousel.tsx` | Swipe container. Receives `children: ReactNode[]`. Manages activeIndex, flippedIndex, touch tracking, translateX transitions. Reports index changes via `onIndexChange` callback. |
| `mobile/hooks/useSwipeNavigation.ts` | Touch gesture hook. Returns `{ offset, isDragging, handlers }`. Pointer Events primary, Touch Events fallback for older Safari. Threshold ~50px, velocity-aware. |
| `mobile/components/DotIndicator.tsx` | Pagination dots. Props: `count`, `activeIndex`. Fixed 12px outer slot per dot, inner circle animates via `transform: scale()` — no reflow, no jitter. |

### Modified Files

| File | Change |
|------|--------|
| `mobile/screens/FocusScreen.tsx` | Rewrite: replace stats/lists with `useFocusBrief` + CardCarousel + DotIndicator. Keep MobileHeader with greeting and task count. |
| `mobile/mobile.css` | Add carousel, dot indicator, and mobile card sizing styles. |
| `components/home/FlipCard.tsx` | Add optional `flipped`/`onFlipChange` props for controlled mode. Internal state used when props omitted (backward compatible). |
| `mobile/mobile.css` | Dog-ear mobile override: `.m-shell .dog-ear` enlarged to 36px. (Scoped to `.m-shell`, belongs with mobile styles.) |

### Desktop Components Reused Unchanged

- `TarotCardFront`, `TarotCardBack` — card anatomy
- `CardBack` / `CardBackContent` — provenance display
- `RightNowPanel`, `TodayAgendaPanel` — pinned panel components
- `PanelRenderer` — ranked panel dispatcher
- `pixel-art/*` — illustrations

## CSS Details

### Carousel

```css
.m-carousel {
  overflow: hidden;
  position: relative;
  touch-action: pan-y;
}

/*
 * Event model: Pointer Events (pointerdown/pointermove/pointerup).
 * touch-action: pan-y tells the browser to handle vertical scroll
 * natively while JS captures horizontal movement.
 *
 * Safari fallback: if drag feels inconsistent on older WebKit,
 * the hook falls back to touchstart/touchmove/touchend with
 * e.preventDefault() on horizontal moves only.
 */

.m-carousel__track {
  display: flex;
  transition: transform 300ms ease;
  will-change: transform;
}

/*
 * --dragging is applied to .m-carousel__track itself (the same
 * element that has the transition). NOT a sibling or parent modifier.
 */
.m-carousel__track.m-carousel__track--dragging {
  transition: none;
}

.m-carousel__slide {
  flex: 0 0 100%;
  min-width: 0;
}
```

### Dot Indicator

```css
.m-dot-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  height: var(--m-dots-h);
}

/* Fixed 12px outer box prevents layout shift */
.m-dot {
  width: 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.m-dot::after {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--m-muted);
  transition: transform 200ms ease, background 200ms ease;
}

.m-dot--active::after {
  transform: scale(1.33);  /* 6px → 8px visual size */
  background: var(--m-accent);
}
```

### Dog-ear Mobile Override

```css
.m-shell .dog-ear { width: 36px; height: 36px; }
.m-shell .dog-ear__fold { border-width: 0 36px 36px 0; }
.m-shell .dog-ear__under { border-width: 0 34px 34px 0; }
```

## Edge Cases

| Case | Behavior |
|------|----------|
| **Loading** | Header shown immediately with skeleton card placeholder (pulsing parchment rectangle). Cards swap in when `useFocusBrief` resolves. |
| **Error / no data** | Header + single card with error message. No dots. Matches desktop HomeDashboard error state. |
| **Swipe while flipped** | Blocked. User must unflip via dog-ear first. |
| **Single card** | Dots hidden. Drag allowed with elastic resistance, no page change. |
| **Edge of deck** | Rubber-band drag resistance (~60% dampening). Snaps back on release. |
| **Null panels** | Filtered before carousel receives the array. Carousel never gets empty slides. |
| **Stale data / refreshing** | Brief shows cached data immediately; background refresh replaces it. Consistent with desktop behavior via `useFocusBrief`. |

## Out of Scope

- Swipe-to-complete/snooze on individual tasks within cards (that's the Today tab pattern)
- Card reordering or manual pinning
- Offline mode / service worker caching
- Animation between loading skeleton and real cards (simple swap is fine for v1)
