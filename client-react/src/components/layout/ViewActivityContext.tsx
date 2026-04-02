import { createContext, useContext } from "react";

interface ViewActivityState {
  isActive: boolean;
}

const ViewActivityContext = createContext<ViewActivityState>({ isActive: true });

export function ViewActivityProvider({
  isActive,
  children,
}: {
  isActive: boolean;
  children: React.ReactNode;
}) {
  return (
    <ViewActivityContext.Provider value={{ isActive }}>
      {children}
    </ViewActivityContext.Provider>
  );
}

/**
 * Returns whether this view is currently active (visible) or cached (hidden).
 * Use to gate expensive effects: polling, timers, observers, animations.
 * Does NOT freeze rendering — views still receive prop updates when inactive.
 */
export function useViewActivity(): ViewActivityState {
  return useContext(ViewActivityContext);
}
