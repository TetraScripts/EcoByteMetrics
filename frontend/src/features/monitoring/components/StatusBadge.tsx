import type { ServiceStatus } from "../types";
import { serviceStatusLabels } from "../types";

export interface StatusBadgeProps {
  status: ServiceStatus;
  showDot?: boolean;
  className?: string;
  labelOverride?: string;
}

export function StatusBadge({
  status,
  showDot = true,
  className = "",
  labelOverride,
}: StatusBadgeProps) {
  const label = labelOverride ?? serviceStatusLabels[status] ?? status;

  return (
    <span
      className={`monitoring-badge monitoring-badge--${status} ${className}`.trim()}
      role="status"
      aria-label={`Status: ${label}`}
    >
      {showDot && (
        <i
          className={`monitoring-badge-dot monitoring-status-dot--${status}`}
          aria-hidden="true"
        />
      )}
      <span>{label}</span>
    </span>
  );
}
