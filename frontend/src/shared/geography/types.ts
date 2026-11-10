export interface ResearchRegion {
  code: string;
  country: string;
  region: string;
  city: string | null;
  latitude?: number;
  longitude?: number;
}
