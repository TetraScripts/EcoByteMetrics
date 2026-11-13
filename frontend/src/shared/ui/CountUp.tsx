import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  to: number | null | undefined;
  duration?: number;
  formatter?: (value: number | null) => string;
  fallback?: string;
}

export function CountUp({
  to,
  duration = 800,
  formatter,
  fallback = "—",
}: CountUpProps) {
  if (to === null || to === undefined || !Number.isFinite(to)) {
    return <>{fallback}</>;
  }

  return (
    <AnimatedNumber
      to={to}
      duration={duration}
      formatter={formatter}
    />
  );
}

function AnimatedNumber({
  to,
  duration = 800,
  formatter,
}: {
  to: number;
  duration?: number;
  formatter?: (value: number | null) => string;
}) {
  const [displayValue, setDisplayValue] = useState<number>(to);
  const prevTo = useRef<number>(to);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion || duration <= 0) {
      prevTo.current = to;
      return;
    }

    const startVal = prevTo.current;
    const endVal = to;
    prevTo.current = to;

    if (startVal === endVal) {
      return;
    }

    const startTime = performance.now();
    let frameId: number;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const nextVal = startVal + (endVal - startVal) * ease;
      setDisplayValue(nextVal);

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endVal);
      }
    };

    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [to, duration]);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const valueToFormat =
    prefersReducedMotion || duration <= 0 ? to : displayValue;

  const formatted = formatter
    ? formatter(valueToFormat)
    : Math.round(valueToFormat).toString();

  return <>{formatted}</>;
}
