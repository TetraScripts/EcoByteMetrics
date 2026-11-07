import type { CarbonRegion } from "../types/monitoring";

export class DiscoveryError extends Error {
  regions: CarbonRegion[] | null;
  catalogWarning?: string;
  constructor(
    message: string,
    regions: CarbonRegion[] | null,
    catalogWarning?: string,
  ) {
    super(message);
    this.name = "DiscoveryError";
    this.regions = regions;
    this.catalogWarning = catalogWarning;
  }
}
