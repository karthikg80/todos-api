import { useState, type ReactNode } from "react";

interface Props {
  front: ReactNode;
  back: ReactNode;
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

export function FlipCard({ front, back, className }: Props) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className={`flip-card ${flipped ? "flip-card--flipped" : ""} ${className || ""}`}
    >
      <div className="flip-card__inner">
        <div className="flip-card__front">
          <DogEar onClick={() => setFlipped(true)} />
          {front}
        </div>
        <div className="flip-card__back">
          <DogEar onClick={() => setFlipped(false)} />
          {back}
        </div>
      </div>
    </div>
  );
}
