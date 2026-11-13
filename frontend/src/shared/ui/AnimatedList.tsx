import type { ReactNode } from "react";
import "./AnimatedList.css";

export function AnimatedListItem({
  children,
  index = 0,
  delay = 35,
  className = "",
}: {
  children: ReactNode;
  index?: number;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={`animated-list-item ${className}`.trim()}
      style={{ animationDelay: `${index * delay}ms` }}
    >
      {children}
    </div>
  );
}
