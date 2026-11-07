import { getTestSnapshot } from './data/monitoring';
import type { Page } from '@playwright/test';
import { test as base, expect } from '@playwright/test';

export const apiRegions = [
  { code: 'br-sudeste', country: 'Brazil', region: 'Sudeste', city: 'Sao Paulo', latitude: -23.5505, longitude: -46.6333, carbon_intensity_gco2e_per_kwh: 85, renewable_share_percent: 83 },
  { code: 'us-east', country: 'United States', region: 'Virginia', city: 'Ashburn', latitude: 39.0438, longitude: -77.4874, carbon_intensity_gco2e_per_kwh: 378, renewable_share_percent: 26 },
  { code: 'eu-west', country: 'Ireland', region: 'Leinster', city: 'Dublin', latitude: 53.3498, longitude: -6.2603, carbon_intensity_gco2e_per_kwh: 295, renewable_share_percent: 38 },
  { code: 'ca-central', country: 'Canada', region: 'Ontario', city: 'Toronto', latitude: 43.6532, longitude: -79.3832, carbon_intensity_gco2e_per_kwh: 40, renewable_share_percent: 89 },
  { code: 'jp-east', country: 'Japan', region: 'Tokyo', city: 'Tokyo', latitude: 35.6762, longitude: 139.6503, carbon_intensity_gco2e_per_kwh: 465, renewable_share_percent: 22 },
];

export const apiService = { id: 'billing-api', name: 'Billing API', location: { ...apiRegions[0], region_code: 'br-sudeste' }, metrics_path: '/metrics/billing-api' };
export const apiMetrics = { get collectedAt() { return new Date().toISOString(); }, collection_interval_seconds: 60, metrics: { cpu_percent: 50, memory_gb: 2, disk_gb: 10, network_gb: 1 } };

export function backendServices(services: unknown[]) {
  return { services, lastUpdatedAt: new Date().toISOString() };
}

// Browser checks use controlled responses; live endpoints change during the challenge.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/backend/services', (route) => route.fulfill({ json: backendServices([]) }));
    await page.route('**/backend/metrics/**', (route) => route.fulfill({ json: [], headers: { 'access-control-allow-origin': '*' } }));
    await page.route('https://carbon.unilaunch.org/**', (route) => route.fulfill({ json: { regions: apiRegions, total: apiRegions.length }, headers: { 'access-control-allow-origin': '*' } }));
    await use(page);
  },
});

export { expect };
export async function mockRegionalScenario(page: Page) {
  const snapshot = getTestSnapshot('7d');
  const regions = snapshot.regions.map(region => ({
    code: region.code, country: region.country, region: region.region, city: region.city,
    latitude: region.latitude, longitude: region.longitude,
    carbon_intensity_gco2e_per_kwh: region.carbonIntensity, renewable_share_percent: region.renewablePercent,
  }));
  await page.route('https://carbon.unilaunch.org/**', route => route.fulfill({ json: { regions } }));
  await page.route('**/backend/services', route => route.fulfill({ json: backendServices(snapshot.services.map(service => ({
    id: service.id, name: service.name, location: { ...service, region_code: service.regionCode },
  }))) }));
  await page.route('**/backend/metrics/**', route => {
    const id = route.request().url().split('/').at(-1);
    return route.fulfill(id === 'demo-fr' ? { status: 500, json: { error: 'service_unavailable' } } :
      { json: id === 'demo-jp' ? { ...apiMetrics, metrics: { ...apiMetrics.metrics, memory_gb: null, disk_gb: null, network_gb: null } } : apiMetrics });
  });
}
