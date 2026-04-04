import type { User } from "../types";

interface Props {
  title: string;
  subtitle?: string;
  user: User | null;
  onAvatarClick: () => void;
  animated?: boolean;
}

export function MobileHeader({ title, subtitle, user, onAvatarClick, animated }: Props) {
  const initial = user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "?";
  return (
    <header className="m-header">
      <div className="m-header__text">
        <h1 className={`m-header__title${animated ? " m-header__title--animate" : ""}`}>{title}</h1>
        {subtitle && <p className={`m-header__subtitle${animated ? " m-header__subtitle--animate" : ""}`}>{subtitle}</p>}
      </div>
      <button className="m-header__avatar" aria-label="Profile and settings" onClick={onAvatarClick}>
        {initial}
      </button>
    </header>
  );
}
