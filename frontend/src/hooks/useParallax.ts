import { useEffect, useRef } from "react";

export function useParallax(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = ref.current;
    if (!layer) return;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = matchMedia("(pointer: fine)");
    let frame = 0;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;

    const allowed = () =>
      enabled && !reducedMotion.matches && finePointer.matches;
    const animate = () => {
      currentX += (targetX - currentX) * 0.065;
      currentY += (targetY - currentY) * 0.065;
      layer.style.setProperty("--pointer-x", `${currentX.toFixed(3)}px`);
      layer.style.setProperty("--pointer-y", `${currentY.toFixed(3)}px`);
      if (
        Math.abs(targetX - currentX) > 0.05 ||
        Math.abs(targetY - currentY) > 0.05
      ) {
        frame = requestAnimationFrame(animate);
      } else {
        frame = 0;
      }
    };
    const start = () => {
      if (!frame) frame = requestAnimationFrame(animate);
    };
    const move = (event: PointerEvent) => {
      if (!allowed()) return;
      targetX = (event.clientX / innerWidth - 0.5) * 72;
      targetY = (event.clientY / innerHeight - 0.5) * 56;
      start();
    };
    const reset = () => {
      targetX = 0;
      targetY = 0;
      start();
    };
    const preferenceChange = () => {
      if (!allowed()) reset();
    };
    const leave = (event: PointerEvent) => {
      if (event.relatedTarget === null) reset();
    };
    layer.style.setProperty("--pointer-x", "0px");
    layer.style.setProperty("--pointer-y", "0px");
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerout", leave);
    window.addEventListener("blur", reset);
    reducedMotion.addEventListener("change", preferenceChange);
    finePointer.addEventListener("change", preferenceChange);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerout", leave);
      window.removeEventListener("blur", reset);
      reducedMotion.removeEventListener("change", preferenceChange);
      finePointer.removeEventListener("change", preferenceChange);
    };
  }, [enabled]);

  return ref;
}
