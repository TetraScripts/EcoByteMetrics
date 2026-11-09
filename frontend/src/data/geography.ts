import world from "./world.json" with { type: "json" };
import type { ResearchRegion } from "../types/monitoring";

export interface CountryFeature {
  type: "Feature";
  properties: {
    code: string;
    name: string;
    nameEn: string;
    latitude: number;
    longitude: number;
  };
  geometry:
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "MultiPolygon"; coordinates: number[][][][] };
}

export interface GlobeCity {
  id: string;
  countryCode: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

export const countries = (world.countries as CountryFeature[]).sort((a, b) =>
  a.properties.name.localeCompare(b.properties.name, "pt-BR"),
);
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
const englishNames = new Intl.DisplayNames(["en"], { type: "region" });
const portugueseNames = new Intl.DisplayNames(["pt-BR"], { type: "region" });
const countryNames = new Map<string, CountryFeature>();
for (const country of countries) {
  const { code, name, nameEn } = country.properties;
  const common =
    code.length === 2
      ? [englishNames.of(code) ?? "", portugueseNames.of(code) ?? ""]
      : [];
  for (const alias of [code, name, nameEn, ...common]) {
    const key = normalize(alias);
    if (key && !countryNames.has(key)) countryNames.set(key, country);
  }
}
for (const alias of ["EUA", "USA", "Estados Unidos da América"])
  countryNames.set(normalize(alias), countryNames.get("us")!);

export function findCountry(name: string) {
  return countryNames.get(normalize(name));
}

export function localizeCity(country: string, city: string | null) {
  if (!city) return null;
  const code = findCountry(country)?.properties.code;
  return (
    world.cities.find(
      (entry) =>
        entry.countryCode === code &&
        [entry.name, entry.nameEn].some(
          (name) => normalize(name) === normalize(city),
        ),
    )?.name ?? city
  );
}

export function getCities(
  countryCode: string,
  regions: ResearchRegion[],
): GlobeCity[] {
  return regions
    .filter(
      (region) => findCountry(region.country)?.properties.code === countryCode,
    )
    .map((region) => ({
      id: region.code,
      countryCode,
      name: region.city ?? region.region,
      latitude: region.latitude ?? null,
      longitude: region.longitude ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
