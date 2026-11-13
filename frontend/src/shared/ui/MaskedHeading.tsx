import { useRef, useState } from "react";
import type { MouseEvent, CSSProperties } from "react";
import "./MaskedHeading.css";

interface MaskedHeadingProps {
  lines: readonly string[] | string[];
  className?: string;
  parallax?: boolean;
}

export function MaskedHeading({
  lines,
  className = "",
  parallax = true,
}: MaskedHeadingProps) {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const [offset, setOffset] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: MouseEvent<HTMLHeadingElement>) => {
    if (!parallax || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setOffset({ x, y });
  };

  const handleMouseLeave = () => {
    setOffset({ x: 50, y: 50 });
  };

  const fullText = lines.join(" ");

  return (
    <h1
      ref={containerRef}
      aria-label={fullText}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`masked-heading ${className}`.trim()}
      style={
        {
          "--mouse-x": `${offset.x}%`,
          "--mouse-y": `${offset.y}%`,
        } as CSSProperties
      }
    >
      {lines.map((line, i) => (
        <span className="masked-heading__line" key={line} aria-hidden="true">
          <span style={{ animationDelay: `${160 + i * 120}ms` }}>{line}</span>
        </span>
      ))}
    </h1>
  );
}
