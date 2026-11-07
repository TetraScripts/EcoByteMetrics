import { useEffect, useState } from "react";

export function useCarousel(length: number, intervalMs = 6000) {
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (length <= 1 || reducedMotion) return;

    const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
    const timer = window.setInterval(() => {
      if (!document.hidden && !motionPreference.matches)
        setIndex((current) => (current + 1) % length);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [length, intervalMs, reducedMotion]);

  return { index };
}
