
export interface CarbonRegionFactor {
  code: string;
  carbonIntensity: number;
}

type CarbonFactorFetcher = () => Promise<CarbonRegionFactor[]>;

const carbonApiUrl = process.env.CARBON_INTENSITY_URL;

export async function fetchCarbonRegionFactors(): Promise<CarbonRegionFactor[]> {
  if (!carbonApiUrl) {
    throw new Error(
      "A variável CARBON_INTENSITY_URL não foi configurada no ambiente.",
    );
  }

  const baseUrl = carbonApiUrl.replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/regions`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(
      `Erro ao consultar fatores de carbono: HTTP ${response.status}`,
    );
  }

  const data: unknown = await response.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !("regions" in data) ||
    !Array.isArray(data.regions)
  ) {
    throw new Error("Resposta inválida: era esperada uma lista de regiões.");
  }

  const factors: CarbonRegionFactor[] = [];
  for (const [index, item] of data.regions.entries()) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("code" in item) ||
      typeof item.code !== "string" ||
      !item.code.trim() ||
      !("carbon_intensity_gco2e_per_kwh" in item) ||
      typeof item.carbon_intensity_gco2e_per_kwh !== "number" ||
      !Number.isFinite(item.carbon_intensity_gco2e_per_kwh) ||
      item.carbon_intensity_gco2e_per_kwh < 0
    ) {
      throw new Error(`Fator de carbono inválido na posição ${index}.`);
    }

    const code = item.code.trim();
    if (factors.some((factor) => factor.code === code)) {
      throw new Error(`Fator de carbono duplicado para a região "${code}".`);
    }
    factors.push({
      code,
      carbonIntensity: item.carbon_intensity_gco2e_per_kwh,
    });
  }

  return factors;
}

let fetchFactors: CarbonFactorFetcher = fetchCarbonRegionFactors;
let carbonFactors = new Map<string, number>();

export async function refreshCarbonRegionFactors(): Promise<void> {
  const factors = await fetchFactors();
  carbonFactors = new Map(
    factors.map((factor) => [factor.code, factor.carbonIntensity]),
  );
}

export function getCarbonIntensity(regionCode: string): number | undefined {
  return carbonFactors.get(regionCode);
}

export function setCarbonFactorsFetcherForTesting(
  fetcher: CarbonFactorFetcher,
): void {
  fetchFactors = fetcher;
}

export function resetCarbonFactorsForTesting(): void {
  fetchFactors = fetchCarbonRegionFactors;
  carbonFactors = new Map();
}
