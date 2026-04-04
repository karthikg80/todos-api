import type { User } from "../types";

interface Props {
  title: string;
  subtitle?: string;
  user: User | null;
  onAvatarClick: () => void;
}

export function MobileHeader({ title, subtitle, user, onAvatarClick }: Props) {
  const initial = user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "?";
  return (
    <header className="m-header">
      <div className="m-header__text">
        <h1 className="m-header__title">{title}</h1>
        {subtitle && <p className="m-header__subtitle">{subtitle}</p>}
      </div>
      <button className="m-header__avatar" aria-label="Profile and settings" onClick={onAvatarClick}>
        {initial}
      </button>
    </header>
  );
}
