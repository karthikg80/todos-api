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
