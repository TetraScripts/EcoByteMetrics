import type { MonitoredService } from "../types/monitoring";
import { findCountry, localizeCity } from "../data/geography";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function matchesRegion(
  service: Pick<MonitoredService, "country" | "city">,
  country: string,
  city: string,
) {
  const placeCountry = service.country ?? "";
  const registeredCountry =
    findCountry(placeCountry)?.properties.code ?? normalize(placeCountry);
  const selectedCountry =
    findCountry(country)?.properties.code ?? normalize(country);
  return (
    (!country || registeredCountry === selectedCountry) &&
    (!city ||
      normalize(localizeCity(placeCountry, service.city) ?? "") ===
        normalize(localizeCity(placeCountry, city) ?? ""))
  );
}

export type RegionAlert = "unknown" | "unavailable" | "incomplete";

export function getRegionAlert(
  services: MonitoredService[],
): RegionAlert | null {
  const current = services.filter((service) => service.status !== "removed");
  if (!current.length) return "unknown";
  if (current.every((service) => service.status === "unavailable"))
    return "unavailable";
  if (
    current.some(
      (service) =>
        service.status !== "available" ||
        [
          service.cpuPercent,
          service.memoryGb,
          service.diskGb,
          service.networkGb,
          service.energyKwh,
          service.emissionsG,
        ].some((value) => value === null),
    )
  )
    return "incomplete";
  return null;
}

export function getRegionIssues(services: MonitoredService[]): string[] {
  return services
    .filter(
      (service) =>
        service.status !== "removed" && getRegionAlert([service]) !== null,
    )
    .map((service) => {
      const missing = [
        ["CPU", service.cpuPercent],
        ["memória RAM", service.memoryGb],
        ["disco", service.diskGb],
        ["rede", service.networkGb],
      ]
        .filter(([, value]) => value === null)
        .map(([label]) => label);
      const reason =
        service.statusMessage ??
        (service.status === "unavailable"
          ? "Serviço indisponível."
          : missing.length
            ? `Métricas ausentes ou inválidas: ${missing.join(", ")}.`
            : service.emissionsG === null
              ? "Não foi possível calcular as emissões com os dados disponíveis."
              : "Não foi possível calcular o consumo energético.");
      return `${service.name}: ${reason}`;
    });
}
