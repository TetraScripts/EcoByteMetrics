import { useCallback, useEffect, useState } from "react";

export function useCarousel(length: number) {
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  const next = useCallback(() => {
    if (!reducedMotion && length > 1) setIndex(current => (current + 1) % length);
  }, [length, reducedMotion]);

  return { index, next, reducedMotion, select: setIndex };
}
