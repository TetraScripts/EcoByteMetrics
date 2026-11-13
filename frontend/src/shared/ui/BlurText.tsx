import { useMemo } from "react";
import "./BlurText.css";

interface BlurTextProps {
  text: string;
  delay?: number;
  className?: string;
  animateBy?: "words" | "letters";
}

export function BlurText({
  text,
  delay = 50,
  className = "",
  animateBy = "words",
}: BlurTextProps) {
  const elements = useMemo(() => {
    return animateBy === "words" ? text.split(" ") : text.split("");
  }, [text, animateBy]);

  return (
    <span className={`blur-text ${className}`.trim()} aria-label={text}>
      {elements.map((element, index) => (
        <span
          key={`${element}-${index}`}
          className="blur-text-word"
          aria-hidden="true"
          style={{
            animationDelay: `${index * delay}ms`,
            marginRight: animateBy === "words" ? "0.28em" : undefined,
          }}
        >
          {element}
        </span>
      ))}
    </span>
  );
}
