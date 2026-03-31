interface Crumb {
  label: string;
  onClick?: () => void;
}

interface Props {
  items: Crumb[];
}

export function Breadcrumb({ items }: Props) {
  if (items.length <= 1) return null;

  return (
    <nav className="breadcrumb" aria-label="Location">
      {items.map((item, i) => (
        <span key={i} className="breadcrumb__item">
          {i > 0 && <span className="breadcrumb__sep" aria-hidden="true">/</span>}
          {item.onClick && i < items.length - 1 ? (
            <button className="breadcrumb__link" onClick={item.onClick}>
              {item.label}
            </button>
          ) : (
            <span className="breadcrumb__current">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
