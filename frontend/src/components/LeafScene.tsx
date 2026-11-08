import { useId } from "react";
import type { CSSProperties } from "react";
import { useParallax } from "../hooks/useParallax";
import { useSettings } from "../hooks/useSettings";

const leaves = [
  { x: "1%", y: "19%", size: 112, rotate: -36, depth: 1.5, blur: 3, delay: -2 },
  { x: "92%", y: "12%", size: 92, rotate: 148, depth: 1.1, blur: 1, delay: -7 },
  {
    x: "62%",
    y: "20%",
    size: 45,
    rotate: -54,
    depth: 0.55,
    blur: 0,
    delay: -4,
  },
  { x: "3%", y: "76%", size: 145, rotate: 23, depth: 1.8, blur: 5, delay: -6 },
  { x: "84%", y: "49%", size: 45, rotate: 75, depth: 0.7, blur: 0, delay: -9 },
  {
    x: "93%",
    y: "84%",
    size: 155,
    rotate: -105,
    depth: 1.7,
    blur: 4,
    delay: -1,
  },
  {
    x: "50%",
    y: "83%",
    size: 62,
    rotate: 127,
    depth: 0.85,
    blur: 1,
    delay: -5,
  },
];

export function LeafScene({ subtle = false }: { subtle?: boolean }) {
  const { settings } = useSettings();
  const ref = useParallax(settings.parallaxEnabled);
  const id = useId().replaceAll(":", "");
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`leaf-scene${subtle ? " leaf-scene-subtle" : ""}${!settings.parallaxEnabled ? " leaf-scene-static" : ""}`}
    >
      {leaves.map((leaf, index) => (
        <div
          key={index}
          className="leaf-position"
          style={
            {
              left: leaf.x,
              top: leaf.y,
              width: leaf.size,
              "--depth": leaf.depth,
              "--leaf-angle": `${leaf.rotate}deg`,
              "--leaf-delay": `${leaf.delay}s`,
              filter: `blur(${leaf.blur}px)`,
            } as CSSProperties
          }
        >
          <svg className="floating-leaf" viewBox="0 0 120 70" fill="none">
            <defs>
              <linearGradient
                id={`${id}-${index}`}
                x1="12"
                y1="65"
                x2="87"
                y2="5"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#123e24" />
                <stop offset=".5" stopColor="#517536" />
                <stop offset=".76" stopColor="#93aa51" />
                <stop offset="1" stopColor="#b2c86d" />
              </linearGradient>
            </defs>
            <path
              d="M8 61C4 15 40-7 114 8C92 65 49 80 8 61Z"
              fill={`url(#${id}-${index})`}
            />
            <path
              d="M4 65C38 43 76 24 112 9M34 48L25 28M51 38L45 16M69 29L67 12M37 47L59 56M57 36L78 42M78 23L93 27"
              stroke="#cfe1a1"
              strokeOpacity=".45"
              strokeWidth="1.2"
            />
          </svg>
        </div>
      ))}
    </div>
  );
}
