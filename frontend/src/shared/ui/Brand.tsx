import { Link } from "react-router-dom";

export function Brand({ linked = true }: { linked?: boolean }) {
  const className = "brand";
  const content = (
    <>
      <img src="/assets/ecobytemetrics-symbol.png" width="44" height="44" alt="" />
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
