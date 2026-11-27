import { useEffect, useState } from "react";

// Same width as Tailwind's `md` breakpoint, so JS layout switches agree with `md:` classes.
const MOBILE_QUERY = "(max-width: 767px)";

function matches() {
  return (
    typeof window !== "undefined" && !!window.matchMedia?.(MOBILE_QUERY).matches
  );
}

/** Whether the window is narrow enough for the mobile layout. Updates as the window resizes. */
export default function useIsMobileLayout() {
  const [isMobileLayout, setIsMobileLayout] = useState(matches);

  useEffect(() => {
    const query = window.matchMedia?.(MOBILE_QUERY);
    if (!query) return;
    const update = () => setIsMobileLayout(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isMobileLayout;
}
