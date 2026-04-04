import { useState, useEffect } from "react";

export function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth <= 700);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)");
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}
