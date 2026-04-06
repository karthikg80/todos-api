import { useState, useEffect, useRef, type ReactNode, Children } from "react";
import { useSwipeNavigation } from "../hooks/useSwipeNavigation";
import { DotIndicator } from "./DotIndicator";

interface Props {
  children: ReactNode[];
}

export function CardCarousel({ children }: Props) {
  const cards = Children.toArray(children);
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const { activeIndex, isDragging, handlers } = useSwipeNavigation({
    count: cards.length,
    locked: flippedIndex !== null,
    onIndexChange: () => setFlippedIndex(null),
  });

  // Apply committed index position via DOM (CSS transition handles animation)
  useEffect(() => {
    if (trackRef.current && !isDragging) {
      trackRef.current.style.transform = `translateX(${-(activeIndex * 100)}%)`;
    }
  }, [activeIndex, isDragging]);

  return (
    <div className="m-carousel">
      <div
        ref={trackRef}
        className="m-carousel__track"
        style={{ transform: `translateX(${-(activeIndex * 100)}%)` }}
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
