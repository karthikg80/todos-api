import { useState, useRef, type ReactNode } from "react";

interface Props {
  content: string;
  shortcut?: string;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({
  content,
  shortcut,
  children,
  position = "top",
}: Props) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(true), 500);
  };

  const hide = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  return (
    <span
      className="tooltip-wrapper"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span className={`tooltip tooltip--${position}`} role="tooltip">
          <span className="tooltip__text">{content}</span>
          {shortcut && <kbd className="tooltip__kbd">{shortcut}</kbd>}
        </span>
      )}
    </span>
  );
}
