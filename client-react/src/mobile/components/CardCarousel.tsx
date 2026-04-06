import { useState, type ReactNode, Children } from "react";
import { useSwipeNavigation } from "../hooks/useSwipeNavigation";
import { DotIndicator } from "./DotIndicator";

interface Props {
  children: ReactNode[];
}

export function CardCarousel({ children }: Props) {
  const cards = Children.toArray(children);
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null);

  const { activeIndex, isDragging, handlers } = useSwipeNavigation({
    count: cards.length,
    locked: flippedIndex !== null,
    onIndexChange: () => setFlippedIndex(null),
  });

  return (
    <div className="m-carousel">
      <div
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
