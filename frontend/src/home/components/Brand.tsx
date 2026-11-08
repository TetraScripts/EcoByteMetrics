import logo from "../assets/ecobyte-logo.png";

interface BrandProps {
  compact?: boolean;
}

export function Brand({ compact = false }: BrandProps) {
  return (
    <a className="brand" href="#inicio" aria-label="EcoByteMetrics — início">
      <img className="brand__mark" src={logo} alt="" aria-hidden="true" />
      {!compact && (
        <span className="brand__wordmark">
          EcoByte<span>Metrics</span>
        </span>
      )}
    </a>
  );
}
