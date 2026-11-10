import { useEffect, useRef } from "react";

export function useHomeReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || !window.IntersectionObserver || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.setAttribute("data-reveal-state", "visible");
        observer.unobserve(entry.target);
      }
    }, { threshold: .12 });
    for (const element of root.querySelectorAll("[data-reveal]")) {
      element.setAttribute("data-reveal-state", "pending");
      observer.observe(element);
    }
    return () => {
      observer.disconnect();
      root.querySelectorAll("[data-reveal]").forEach(element => element.removeAttribute("data-reveal-state"));
    };
  }, []);
  return ref;
}
