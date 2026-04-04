import { useState, useRef, useCallback } from "react";

interface Props {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const THRESHOLD = 60;

export function PullToRefresh({ onRefresh, children }: Props) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    if (scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pulling || startY.current === 0) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0) {
        // Resistance: actual distance is sqrt of raw delta
        setPullDistance(Math.min(Math.sqrt(delta) * 4, 120));
      }
    },
    [pulling],
  );

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance > THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
    setPulling(false);
    startY.current = 0;
  }, [pullDistance, refreshing, onRefresh]);

  return (
    <div
      ref={containerRef}
      className="m-pull-refresh"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className={`m-pull-refresh__indicator${refreshing ? " m-pull-refresh__indicator--active" : ""}`}
        style={{ height: pullDistance > 0 ? `${pullDistance}px` : undefined }}
      >
        {refreshing ? (
          <div className="m-pull-refresh__spinner" />
        ) : pullDistance > THRESHOLD ? (
          <span className="m-pull-refresh__text">Release to refresh</span>
        ) : pullDistance > 10 ? (
          <span className="m-pull-refresh__text">Pull to refresh</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
