import { Link } from "react-router-dom";

export function Brand({ light = false, linked = true }: { light?: boolean; linked?: boolean }) {
  const className = `brand${light ? " brand-light" : ""}`;
  const content = (
    <>
      <img src="/assets/logo.png" width="44" height="40" alt="" />
      <span>
        EcoByte<span>Metrics</span>
      </span>
    </>
  );
  if (!linked) return <div className={className}>{content}</div>;
  return (
    <Link
      className={className}
      to="/"
      aria-label="EcoByteMetrics, início"
    >
      {content}
    </Link>
  );
}
