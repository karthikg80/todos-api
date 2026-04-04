import type { User } from "../../types";
import type { WorkspaceView } from "../../components/projects/Sidebar";
import { CUSTOM_TAB_OPTIONS } from "../hooks/useTabBar";

interface Props {
  open: boolean;
  onClose: () => void;
  user: User | null;
  dark: boolean;
  onToggleDark: () => void;
  customView: WorkspaceView;
  onChangeCustomView: (view: WorkspaceView) => void;
  onLogout: () => void;
}

function getUserInitial(user: User | null): string {
  if (!user) return "?";
  if (user.name) return user.name.charAt(0).toUpperCase();
  return user.email.charAt(0).toUpperCase();
}

function getNextCustomView(current: WorkspaceView): WorkspaceView {
  const idx = CUSTOM_TAB_OPTIONS.findIndex((o) => o.key === current);
  const next = CUSTOM_TAB_OPTIONS[(idx + 1) % CUSTOM_TAB_OPTIONS.length];
  return next.key;
}

function getCustomViewLabel(view: WorkspaceView): string {
  return CUSTOM_TAB_OPTIONS.find((o) => o.key === view)?.label ?? view;
}

export function ProfileSheet({
  open,
  onClose,
  user,
  dark,
  onToggleDark,
  customView,
  onChangeCustomView,
  onLogout,
}: Props) {
  if (!open) return null;

  return (
    <>
      <div className="m-capture__backdrop" onClick={onClose} />
      <div className="m-profile" role="dialog" aria-modal="true" aria-label="Profile and settings">
        <div className="m-bottom-sheet__handle">
          <div className="m-bottom-sheet__handle-bar" />
        </div>

        {/* User info section */}
        <div className="m-profile__user">
          <div className="m-profile__avatar">{getUserInitial(user)}</div>
          <div className="m-profile__user-text">
            {user?.name && <div className="m-profile__user-name">{user.name}</div>}
            <div className="m-profile__user-email">{user?.email ?? ""}</div>
            {user?.plan && <div className="m-profile__user-plan">{user.plan}</div>}
          </div>
        </div>

        <div className="m-profile__divider" />

        {/* Appearance section */}
        <div className="m-profile__section">
          <div className="m-profile__section-label">Appearance</div>
          <div className="m-profile__row">
            <span className="m-profile__row-label">Dark mode</span>
            <button
              className={`m-profile__toggle${dark ? " m-profile__toggle--on" : ""}`}
              onClick={onToggleDark}
              aria-pressed={dark}
              aria-label="Toggle dark mode"
            >
              <span className="m-profile__toggle-knob" />
            </button>
          </div>
        </div>

        <div className="m-profile__divider" />

        {/* Custom tab section */}
        <div className="m-profile__section">
          <div className="m-profile__section-label">Custom Tab</div>
          <div className="m-profile__row">
            <span className="m-profile__row-label">4th tab shows</span>
            <button
              className="m-profile__cycle-btn"
              onClick={() => onChangeCustomView(getNextCustomView(customView))}
              aria-label={`Custom tab: ${getCustomViewLabel(customView)}, tap to change`}
            >
              {getCustomViewLabel(customView)} ›
            </button>
          </div>
        </div>

        <div className="m-profile__divider" />

        {/* Logout */}
        <div className="m-profile__footer">
          <button
            className="m-profile__logout"
            onClick={() => { onLogout(); onClose(); }}
          >
            Log out
          </button>
        </div>
      </div>
    </>
  );
}
