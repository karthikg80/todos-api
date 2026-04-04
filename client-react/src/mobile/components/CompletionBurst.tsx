interface Props {
  active: boolean;
}

export function CompletionBurst({ active }: Props) {
  if (!active) return null;

  return (
    <div className="m-burst" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="m-burst__dot"
          style={{
            "--angle": `${i * 45}deg`,
            animationDelay: `${i * 20}ms`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
