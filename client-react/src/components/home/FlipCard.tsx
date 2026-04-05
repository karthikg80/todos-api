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
