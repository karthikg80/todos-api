# Mobile Focus Tarot Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the mobile Focus tab to display tarot cards in a swipeable one-at-a-time carousel with flip-to-reveal provenance, reusing the desktop card components.

**Architecture:** New `CardCarousel` component with `useSwipeNavigation` hook manages horizontal swipe + `translateX` transitions. `FlipCard` gains optional controlled mode (backward-compatible). `FocusScreen` is rewritten to call `useFocusBrief()` and feed cards into the carousel.

**Tech Stack:** React, TypeScript, CSS custom properties, Pointer Events

**Spec:** `docs/superpowers/specs/2026-04-05-mobile-focus-tarot-carousel-design.md`

---

### Task 1: Add controlled mode to FlipCard

**Files:**
- Modify: `client-react/src/components/home/FlipCard.tsx`
- Modify: `client-react/src/components/home/FlipCard.test.tsx`

- [ ] **Step 1: Write failing tests for controlled mode**

Add these tests to the existing `FlipCard.test.tsx`:

```typescript
it("uses controlled flipped prop when provided", () => {
  const { rerender } = render(
    <FlipCard
      front={<div>Front</div>}
      back={<div>Back</div>}
      flipped={false}
      onFlipChange={() => {}}
    />,
  );
  // Card should not have flipped class
  expect(document.querySelector(".flip-card--flipped")).not.toBeInTheDocument();

  rerender(
    <FlipCard
      front={<div>Front</div>}
      back={<div>Back</div>}
      flipped={true}
      onFlipChange={() => {}}
    />,
  );
  expect(document.querySelector(".flip-card--flipped")).toBeInTheDocument();
});

it("calls onFlipChange instead of toggling internal state in controlled mode", () => {
  const onFlipChange = vi.fn();
  render(
    <FlipCard
      front={<div>Front</div>}
      back={<div>Back</div>}
      flipped={false}
      onFlipChange={onFlipChange}
    />,
  );
  const dogEar = screen.getAllByTitle(/flip/i)[0];
  fireEvent.click(dogEar);
  expect(onFlipChange).toHaveBeenCalledWith(true);
  // Card should NOT have flipped class (parent hasn't updated prop)
  expect(document.querySelector(".flip-card--flipped")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && cd client-react && npx vitest run src/components/home/FlipCard.test.tsx'`

Expected: 2 new tests FAIL (FlipCard doesn't accept `flipped`/`onFlipChange` props yet).

- [ ] **Step 3: Implement controlled mode**

Replace the contents of `client-react/src/components/home/FlipCard.tsx`:

```typescript
import { useState, type ReactNode } from "react";

interface Props {
  front: ReactNode;
  back: ReactNode;
  flipped?: boolean;
  onFlipChange?: (flipped: boolean) => void;
  className?: string;
}

function DogEar({ onClick }: { onClick: () => void }) {
  return (
    <div className="dog-ear" onClick={onClick} title="Flip card">
      <div className="dog-ear__fold" />
      <div className="dog-ear__under" />
    </div>
  );
}

export function FlipCard({ front, back, flipped: controlledFlipped, onFlipChange, className }: Props) {
  const [internalFlipped, setInternalFlipped] = useState(false);
  const isControlled = controlledFlipped !== undefined;
  const flipped = isControlled ? controlledFlipped : internalFlipped;

  const handleFlip = (next: boolean) => {
    if (isControlled) {
      onFlipChange?.(next);
    } else {
      setInternalFlipped(next);
    }
  };

  return (
    <div
      className={`flip-card ${flipped ? "flip-card--flipped" : ""} ${className || ""}`}
    >
      <div className="flip-card__inner">
        <div className="flip-card__front">
          <DogEar onClick={() => handleFlip(true)} />
          {front}
        </div>
        <div className="flip-card__back">
          <DogEar onClick={() => handleFlip(false)} />
          {back}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && cd client-react && npx vitest run src/components/home/FlipCard.test.tsx'`

Expected: All 5 tests pass (3 existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add client-react/src/components/home/FlipCard.tsx client-react/src/components/home/FlipCard.test.tsx
git commit -m "feat(react): add controlled mode to FlipCard for carousel integration"
```

---

### Task 2: Create useSwipeNavigation hook

**Files:**
- Create: `client-react/src/mobile/hooks/useSwipeNavigation.ts`
- Create: `client-react/src/mobile/hooks/useSwipeNavigation.test.ts`

- [ ] **Step 1: Write failing tests**

Create `client-react/src/mobile/hooks/useSwipeNavigation.test.ts`:

```typescript
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useSwipeNavigation } from "./useSwipeNavigation";

describe("useSwipeNavigation", () => {
  it("starts at index 0", () => {
    const { result } = renderHook(() => useSwipeNavigation({ count: 5 }));
    expect(result.current.activeIndex).toBe(0);
  });

  it("advances index on commitNext", () => {
    const { result } = renderHook(() => useSwipeNavigation({ count: 5 }));
    act(() => result.current.goNext());
    expect(result.current.activeIndex).toBe(1);
  });

  it("decrements index on commitPrev", () => {
    const { result } = renderHook(() => useSwipeNavigation({ count: 5 }));
    act(() => result.current.goNext());
    act(() => result.current.goPrev());
    expect(result.current.activeIndex).toBe(0);
  });

  it("clamps at 0 when going prev", () => {
    const { result } = renderHook(() => useSwipeNavigation({ count: 5 }));
    act(() => result.current.goPrev());
    expect(result.current.activeIndex).toBe(0);
  });

  it("clamps at count-1 when going next", () => {
    const { result } = renderHook(() => useSwipeNavigation({ count: 3 }));
    act(() => result.current.goNext());
    act(() => result.current.goNext());
    act(() => result.current.goNext()); // past end
    expect(result.current.activeIndex).toBe(2);
  });

  it("blocks navigation when locked", () => {
    const { result } = renderHook(() => useSwipeNavigation({ count: 5, locked: true }));
    act(() => result.current.goNext());
    expect(result.current.activeIndex).toBe(0);
  });

  it("reports isDragging false initially", () => {
    const { result } = renderHook(() => useSwipeNavigation({ count: 5 }));
    expect(result.current.isDragging).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && cd client-react && npx vitest run src/mobile/hooks/useSwipeNavigation.test.ts'`

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the hook**

Create `client-react/src/mobile/hooks/useSwipeNavigation.ts`:

```typescript
import { useState, useRef, useCallback, useMemo } from "react";

const COMMIT_THRESHOLD = 50; // px
const VELOCITY_THRESHOLD = 0.3; // px/ms
const RUBBER_DAMPING = 0.4; // 60% reduction past edges

interface Options {
  count: number;
  locked?: boolean;
  onIndexChange?: (index: number) => void;
}

export function useSwipeNavigation({ count, locked, onIndexChange }: Options) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startX = useRef(0);
  const startTime = useRef(0);

  const goNext = useCallback(() => {
    if (locked) return;
    setActiveIndex((i) => {
      const next = Math.min(i + 1, count - 1);
      if (next !== i) onIndexChange?.(next);
      return next;
    });
  }, [count, locked, onIndexChange]);

  const goPrev = useCallback(() => {
    if (locked) return;
    setActiveIndex((i) => {
      const next = Math.max(i - 1, 0);
      if (next !== i) onIndexChange?.(next);
      return next;
    });
  }, [locked, onIndexChange]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (locked) return;
      startX.current = e.clientX;
      startTime.current = Date.now();
      setIsDragging(true);
      setDragOffset(0);
    },
    [locked],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || locked) return;
      let dx = e.clientX - startX.current;

      // Rubber-band at edges
      const atStart = activeIndex === 0 && dx > 0;
      const atEnd = activeIndex === count - 1 && dx < 0;
      if (atStart || atEnd) {
        dx = dx * RUBBER_DAMPING;
      }

      setDragOffset(dx);
    },
    [isDragging, locked, activeIndex, count],
  );

  const onPointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const elapsed = Date.now() - startTime.current;
    const velocity = Math.abs(dragOffset) / Math.max(elapsed, 1);
    const committed =
      Math.abs(dragOffset) > COMMIT_THRESHOLD || velocity > VELOCITY_THRESHOLD;

    if (committed && dragOffset < 0) {
      goNext();
    } else if (committed && dragOffset > 0) {
      goPrev();
    }

    setDragOffset(0);
  }, [isDragging, dragOffset, goNext, goPrev]);

  const handlers = useMemo(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    }),
    [onPointerDown, onPointerMove, onPointerUp],
  );

  return { activeIndex, dragOffset, isDragging, handlers, goNext, goPrev };
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && cd client-react && npx vitest run src/mobile/hooks/useSwipeNavigation.test.ts'`

Expected: All 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add client-react/src/mobile/hooks/useSwipeNavigation.ts client-react/src/mobile/hooks/useSwipeNavigation.test.ts
git commit -m "feat(react-mobile): add useSwipeNavigation hook for card carousel"
```

---

### Task 3: Create DotIndicator component

**Files:**
- Create: `client-react/src/mobile/components/DotIndicator.tsx`
- Create: `client-react/src/mobile/components/DotIndicator.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `client-react/src/mobile/components/DotIndicator.test.tsx`:

```typescript
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DotIndicator } from "./DotIndicator";

describe("DotIndicator", () => {
  it("renders correct number of dots", () => {
    const { container } = render(<DotIndicator count={5} activeIndex={0} />);
    expect(container.querySelectorAll(".m-dot").length).toBe(5);
  });

  it("marks the active dot", () => {
    const { container } = render(<DotIndicator count={3} activeIndex={1} />);
    const dots = container.querySelectorAll(".m-dot");
    expect(dots[0].classList.contains("m-dot--active")).toBe(false);
    expect(dots[1].classList.contains("m-dot--active")).toBe(true);
    expect(dots[2].classList.contains("m-dot--active")).toBe(false);
  });

  it("renders nothing when count is 0", () => {
    const { container } = render(<DotIndicator count={0} activeIndex={0} />);
    expect(container.querySelector(".m-dot-indicator")).toBeNull();
  });

  it("renders nothing when count is 1", () => {
    const { container } = render(<DotIndicator count={1} activeIndex={0} />);
    expect(container.querySelector(".m-dot-indicator")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && cd client-react && npx vitest run src/mobile/components/DotIndicator.test.tsx'`

- [ ] **Step 3: Implement DotIndicator**

Create `client-react/src/mobile/components/DotIndicator.tsx`:

```typescript
interface Props {
  count: number;
  activeIndex: number;
}

export function DotIndicator({ count, activeIndex }: Props) {
  if (count <= 1) return null;

  return (
    <div className="m-dot-indicator" role="tablist" aria-label="Card position">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`m-dot${i === activeIndex ? " m-dot--active" : ""}`}
          role="tab"
          aria-selected={i === activeIndex}
          aria-label={`Card ${i + 1} of ${count}`}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && cd client-react && npx vitest run src/mobile/components/DotIndicator.test.tsx'`

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add client-react/src/mobile/components/DotIndicator.tsx client-react/src/mobile/components/DotIndicator.test.tsx
git commit -m "feat(react-mobile): add DotIndicator pagination component"
```

---

### Task 4: Create CardCarousel component

**Files:**
- Create: `client-react/src/mobile/components/CardCarousel.tsx`
- Create: `client-react/src/mobile/components/CardCarousel.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `client-react/src/mobile/components/CardCarousel.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CardCarousel } from "./CardCarousel";

describe("CardCarousel", () => {
  const cards = [
    <div key="a">Card A</div>,
    <div key="b">Card B</div>,
    <div key="c">Card C</div>,
  ];

  it("renders all slides", () => {
    render(<CardCarousel>{cards}</CardCarousel>);
    expect(screen.getByText("Card A")).toBeInTheDocument();
    expect(screen.getByText("Card B")).toBeInTheDocument();
    expect(screen.getByText("Card C")).toBeInTheDocument();
  });

  it("renders dot indicator with correct count", () => {
    const { container } = render(<CardCarousel>{cards}</CardCarousel>);
    expect(container.querySelectorAll(".m-dot").length).toBe(3);
  });

  it("first dot is active by default", () => {
    const { container } = render(<CardCarousel>{cards}</CardCarousel>);
    const dots = container.querySelectorAll(".m-dot");
    expect(dots[0].classList.contains("m-dot--active")).toBe(true);
  });

  it("hides dots for single card", () => {
    const { container } = render(
      <CardCarousel>{[<div key="only">Only card</div>]}</CardCarousel>,
    );
    expect(container.querySelector(".m-dot-indicator")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && cd client-react && npx vitest run src/mobile/components/CardCarousel.test.tsx'`

- [ ] **Step 3: Implement CardCarousel**

Create `client-react/src/mobile/components/CardCarousel.tsx`:

```typescript
import { useState, type ReactNode, Children } from "react";
import { useSwipeNavigation } from "../hooks/useSwipeNavigation";
import { DotIndicator } from "./DotIndicator";

interface Props {
  children: ReactNode[];
  onFlippedChange?: (isFlipped: boolean) => void;
}

export function CardCarousel({ children }: Props) {
  const cards = Children.toArray(children);
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null);

  const { activeIndex, dragOffset, isDragging, handlers } = useSwipeNavigation({
    count: cards.length,
    locked: flippedIndex !== null,
    onIndexChange: () => setFlippedIndex(null),
  });

  const translateX = -(activeIndex * 100) + (dragOffset / (typeof window !== "undefined" ? window.innerWidth : 375)) * 100;

  return (
    <div className="m-carousel">
      <div
        className={`m-carousel__track${isDragging ? " m-carousel__track--dragging" : ""}`}
        style={{ transform: `translateX(${translateX}%)` }}
        {...handlers}
      >
        {cards.map((card, i) => (
          <div key={i} className="m-carousel__slide">
            {card}
          </div>
        ))}
      </div>
      <DotIndicator count={cards.length} activeIndex={activeIndex} />
    </div>
  );
}

export { type Props as CardCarouselProps };
```

Note: The `flippedIndex` state is available for wiring to `FlipCard` controlled mode. `FocusScreen` (Task 6) will pass `flipped`/`onFlipChange` props through when rendering cards inside the carousel. The carousel exposes its locked state by checking `flippedIndex !== null`.

- [ ] **Step 4: Run tests to verify all pass**

Run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && cd client-react && npx vitest run src/mobile/components/CardCarousel.test.tsx'`

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add client-react/src/mobile/components/CardCarousel.tsx client-react/src/mobile/components/CardCarousel.test.tsx
git commit -m "feat(react-mobile): add CardCarousel swipe container component"
```

---

### Task 5: Add mobile carousel and dot indicator CSS

**Files:**
- Modify: `client-react/src/mobile/mobile.css`

- [ ] **Step 1: Add carousel, dot indicator, dog-ear override, and card sizing styles**

Append the following to the end of `client-react/src/mobile/mobile.css`:

```css
/* ── Focus Carousel ───────────────────────────── */

.m-carousel {
  overflow: hidden;
  position: relative;
  touch-action: pan-y;
  flex: 1;
  min-height: 0;
}

/*
 * Event model: Pointer Events (pointerdown/pointermove/pointerup).
 * touch-action: pan-y lets the browser handle vertical scroll
 * natively while JS captures horizontal movement.
 */

.m-carousel__track {
  display: flex;
  transition: transform 300ms ease;
  will-change: transform;
  height: 100%;
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
  padding: 0 var(--m-gutter, 16px);
  box-sizing: border-box;
}

/* ── Card height tokens ───────────────────────── */

.m-screen--focus {
  --m-header-h: 52px;
  --m-dots-h: 32px;
  --m-tabbar-h: 56px;
  --m-safe-b: env(safe-area-inset-bottom, 0px);
  --m-card-gap: 24px;
  display: flex;
  flex-direction: column;
  height: calc(
    100dvh
    - var(--m-tabbar-h)
    - var(--m-safe-b)
  );
}

.m-screen--focus .m-carousel {
  flex: 1;
  min-height: 0;
}

.m-screen--focus .flip-card {
  height: 100%;
}

/* ── Dot Indicator ────────────────────────────── */

.m-dot-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  height: var(--m-dots-h, 32px);
  flex-shrink: 0;
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
  transform: scale(1.33);
  background: var(--m-accent);
}

/* ── Dog-ear mobile override ──────────────────── */

.m-shell .dog-ear { width: 36px; height: 36px; }
.m-shell .dog-ear__fold { border-width: 0 36px 36px 0; }
.m-shell .dog-ear__under { border-width: 0 34px 34px 0; }
```

- [ ] **Step 2: Run CSS lint**

Run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && npm run lint:css'`

Expected: Pass.

- [ ] **Step 3: Commit**

```bash
git add client-react/src/mobile/mobile.css
git commit -m "feat(react-mobile): add carousel, dot indicator, and card sizing styles"
```

---

### Task 6: Rewrite FocusScreen to use tarot card carousel

**Files:**
- Modify: `client-react/src/mobile/screens/FocusScreen.tsx`

- [ ] **Step 1: Rewrite FocusScreen**

Replace the entire contents of `client-react/src/mobile/screens/FocusScreen.tsx`:

```typescript
import { useMemo } from "react";
import type { Todo, Project, User } from "../../types";
import { MobileHeader } from "../MobileHeader";
import { CardCarousel } from "../components/CardCarousel";
import { useFocusBrief } from "../../hooks/useFocusBrief";
import { RightNowPanel } from "../../components/home/RightNowPanel";
import { TodayAgendaPanel } from "../../components/home/TodayAgendaPanel";
import { PanelRenderer } from "../../components/home/PanelRenderer";
import type { ReactNode } from "react";

interface Props {
  todos: Todo[];
  projects: Project[];
  user: User | null;
  onTodoClick: (id: string) => void;
  onToggleTodo: (id: string, completed: boolean) => void;
  onAvatarClick: () => void;
  onSnoozeTodo: (id: string) => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function FocusScreen({ todos, projects, user, onTodoClick, onToggleTodo, onAvatarClick }: Props) {
  const { brief, loading, error } = useFocusBrief();

  const openTodos = useMemo(() => todos.filter((t) => !t.completed && !t.archived), [todos]);
  const todayCount = useMemo(() => {
    const now = new Date(new Date().toDateString());
    return openTodos.filter((t) => t.dueDate && new Date(t.dueDate) <= now).length;
  }, [openTodos]);
  const overdueCount = useMemo(() => {
    const now = new Date(new Date().toDateString());
    return openTodos.filter((t) => t.dueDate && new Date(t.dueDate) < now).length;
  }, [openTodos]);

  const subtitle = `${todayCount} tasks today${overdueCount ? ` · ${overdueCount} overdue` : ""}`;

  const cards = useMemo(() => {
    if (!brief) return [];
    const result: ReactNode[] = [];

    result.push(
      <RightNowPanel
        key="rightNow"
        data={brief.pinned.rightNow}
        provenance={brief.pinned.rightNowProvenance}
        onTaskClick={onTodoClick}
      />,
    );

    result.push(
      <TodayAgendaPanel
        key="todayAgenda"
        items={brief.pinned.todayAgenda}
        provenance={brief.pinned.todayAgendaProvenance}
        onTaskClick={onTodoClick}
        onToggle={onToggleTodo}
      />,
    );

    for (const panel of brief.rankedPanels) {
      const node = (
        <PanelRenderer
          key={panel.type}
          panel={panel}
          onTaskClick={onTodoClick}
          onSelectProject={() => {}}
        />
      );
      result.push(node);
    }

    return result;
  }, [brief, onTodoClick, onToggleTodo]);

  return (
    <div className="m-screen m-screen--focus">
      <MobileHeader
        title={getGreeting()}
        subtitle={subtitle}
        user={user}
        onAvatarClick={onAvatarClick}
      />
      {loading && !brief && (
        <div className="m-carousel">
          <div className="m-carousel__skeleton" />
        </div>
      )}
      {error && !brief && (
        <div className="m-focus__error">
          <p>Failed to load focus brief.</p>
        </div>
      )}
      {cards.length > 0 && <CardCarousel>{cards}</CardCarousel>}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && cd client-react && npx tsc --noEmit'`

Expected: Pass.

- [ ] **Step 3: Add skeleton and error styles**

Append to `client-react/src/mobile/mobile.css`:

```css
/* ── Focus loading / error ────────────────────── */

.m-carousel__skeleton {
  flex: 1;
  margin: 0 var(--m-gutter, 16px);
  background: linear-gradient(165deg, var(--m-surface-2) 0%, var(--m-surface) 100%);
  border: 1px solid var(--m-surface-3, rgba(255,255,255,0.06));
  border-radius: var(--m-r-lg, 12px);
  animation: m-skeleton-pulse 1.5s ease-in-out infinite;
}

@keyframes m-skeleton-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.m-focus__error {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--m-muted);
  font-size: 14px;
}
```

- [ ] **Step 4: Commit**

```bash
git add client-react/src/mobile/screens/FocusScreen.tsx client-react/src/mobile/mobile.css
git commit -m "feat(react-mobile): rewrite FocusScreen with tarot card carousel"
```

---

### Task 7: Run all verification checks

**Files:** None (verification only)

- [ ] **Step 1: Typecheck**

Run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && cd client-react && npx tsc --noEmit'`

- [ ] **Step 2: Run all React tests**

Run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && cd client-react && npx vitest run'`

All new tests (FlipCard controlled mode, useSwipeNavigation, DotIndicator, CardCarousel) plus existing tests should pass.

- [ ] **Step 3: Format check**

Run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && npm run format:check'`

If formatting issues in our changed files, fix with: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && npx prettier --write client-react/src/mobile/ client-react/src/components/home/FlipCard.tsx client-react/src/components/home/FlipCard.test.tsx'`

- [ ] **Step 4: Architecture check**

Run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && npm run check:architecture'`

- [ ] **Step 5: CSS lint**

Run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && npm run lint:css'`

- [ ] **Step 6: Fix any issues and commit if needed**

```bash
git add -u
git commit -m "chore: fix lint/format issues from mobile focus carousel"
```
