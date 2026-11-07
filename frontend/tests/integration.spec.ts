import { test, expect, apiService, apiRegions, apiMetrics, backendServices } from './fixtures';
import { getMonitoringSnapshot } from '../src/services/monitoring';
import { commonCollectionPoints, summarizeCollections } from '../src/utils/history';
import { formatNumber } from '../src/utils/format';
import type { CollectionPoint } from '../src/types/monitoring';

async function snapshotFrom(discovery: unknown, regions: unknown = { regions: apiRegions }, metrics: unknown = apiMetrics) {
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    return Response.json(url.endsWith('/services') ? discovery : url.endsWith('/regions') ? regions : metrics);
  };
  try { return { snapshot: await getMonitoringSnapshot(), urls }; }
  finally { globalThis.fetch = original; }
}

test('discovery consumes the team envelope and distinguishes initial cache from an empty registry', async () => {
  await expect(snapshotFrom({ services: [], lastUpdatedAt: null })).rejects.toThrow('ainda não concluiu');
  await expect(snapshotFrom([])).rejects.toThrow('Resposta inválida do backend');
  const { snapshot, urls } = await snapshotFrom(backendServices([]));
  expect(snapshot.services).toEqual([]);
  expect(urls).toContain('/backend/services');
  expect(urls).not.toContain('https://metrics.unilaunch.org/services');
});

test('malformed services and carbon regions do not discard valid observations', async () => {
  const invalid = { ...apiService, id: 'bad-location', location: { ...apiService.location, latitude: null } };
  const { snapshot } = await snapshotFrom(backendServices([apiService, invalid, { name: 'missing-id' }]),
    { regions: [apiRegions[0], { ...apiRegions[1], renewable_share_percent: null }] });
  expect(snapshot.services[0].status).toBe('available');
  expect(snapshot.services[1].status).toBe('available');
  expect(snapshot.regions).toHaveLength(1);
  expect(snapshot.totalEmissionsG).toBeGreaterThan(0);
  expect(snapshot.discoveryComplete).toBe(false);
  expect(snapshot.warning).toContain('Localização incompleta');
});

test('stale discovery and missing regional factors disclose incomplete emissions', async () => {
  const { snapshot } = await snapshotFrom({ services: [apiService], lastUpdatedAt: '2000-01-01T00:00:00Z' }, { regions: [] });
  expect(snapshot.warning).toContain('desatualizada');
  expect(snapshot.warning).toContain('0 de 1 serviços');
  expect(snapshot.totalEnergyKwh).toBeGreaterThan(0);
  expect(snapshot.totalEmissionsG).toBeNull();
});

test('fractional intervals and overflowing calculations never become valid estimates', async () => {
  const fractional = await snapshotFrom(backendServices([apiService]), undefined, { ...apiMetrics, collection_interval_seconds: 0.5 });
  expect(fractional.snapshot.services[0].status).toBe('no-metrics');
  expect(fractional.snapshot.history).toEqual([]);
  const overflow = await snapshotFrom(backendServices([apiService]), undefined,
    { collectedAt: new Date().toISOString(), collection_interval_seconds: Number.MAX_SAFE_INTEGER, metrics: { cpu_percent: 50, memory_gb: Number.MAX_VALUE, disk_gb: Number.MAX_VALUE, network_gb: Number.MAX_VALUE } });
  expect(overflow.snapshot.totalEnergyKwh).toBeNull();
});

test('common collection cycles normalize different intervals and preserve missing emissions', () => {
  const points: CollectionPoint[] = [
    { serviceId: 'a', collectedAt: '2026-10-13T12:00:00Z', energyKwh: 0.001, emissionsG: 0.1, intervalSeconds: 30 },
    { serviceId: 'b', collectedAt: '2026-10-13T12:00:00Z', energyKwh: 0.002, emissionsG: 0.2, intervalSeconds: 60 },
    { serviceId: 'a', collectedAt: '2026-10-13T12:01:00Z', energyKwh: 9, emissionsG: null, intervalSeconds: 30 },
  ];
  const common = commonCollectionPoints(points, ['a', 'b']);
  expect(common).toHaveLength(2);
  expect(summarizeCollections(common.filter((point) => point.serviceId === 'a')).energyPerHourKwh).toBeCloseTo(0.12);
  expect(summarizeCollections(common.filter((point) => point.serviceId === 'b')).energyPerHourKwh).toBeCloseTo(0.12);
  const all = summarizeCollections(points);
  expect(all.emissionCount).toBe(2);
  expect(all.emissionsPerHourG).toBeNull();
  expect(summarizeCollections([]).energyKwh).toBeNull();
  expect(formatNumber(0.00000012)).not.toBe('0');
  expect(formatNumber(0)).toBe('0');
  expect(formatNumber(Infinity)).toBe('—');
});

test('only monitoring routes collect data and changing period requests fresh data', async ({ page }) => {
  let calls = 0;
  await page.route('**/backend/services', (route) => { calls++; return route.fulfill({ json: backendServices([]) }); });
  for (const path of ['/', '/login', '/cadastro', '/configuracoes', '/gerenciamento', '/energia', '/comparar', '/emissoes', '/servicos', '/servicos/service-0', '/unknown']) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
  }
  expect(calls).toBe(0);
  await page.goto('/dashboard');
  await expect.poll(() => calls).toBe(1);
  await page.getByLabel('Período de análise').selectOption('24h');
  await expect(page.getByLabel('Período de análise')).toHaveValue('24h');
  await expect.poll(() => calls).toBe(2);
});

test.fixme('comparison displays equal hourly estimates for unequal collection intervals [Sprint 2]', async ({ page }) => {
  const services = [30, 60].map((seconds) => ({ ...apiService, id: 'service-' + seconds, name: 'Service ' + seconds }));
  await page.route('**/backend/services', (route) => route.fulfill({ json: backendServices(services) }));
  await page.route('**/backend/metrics/**', (route) => route.fulfill({ json: {
    collectedAt: new Date().toISOString(), collection_interval_seconds: Number(route.request().url().split('-').at(-1)),
    metrics: { cpu_percent: 50, memory_gb: 0, disk_gb: 0, network_gb: 0 },
  } }));
  await page.goto('/comparar');
  const select = page.getByLabel('Adicionar serviço à comparação');
  await select.selectOption('service-30');
  await select.selectOption('service-60');
  const energy = page.getByRole('row', { name: /Energia estimada · kWh\/h/ });
  await expect(energy.locator('td')).toHaveText(['0,05', '0,05']);
  await expect(page.getByRole('row', { name: /Soma dos intervalos informados/ }).locator('td')).toHaveText(['30', '60']);
});

test('region selection preserves distinct codes for the same city', async ({ page }) => {
  test.slow();
  const alternate = { ...apiRegions[0], code: 'br-alternate', carbon_intensity_gco2e_per_kwh: 150 };
  await page.route('https://carbon.unilaunch.org/**', (route) => route.fulfill({ json: { regions: [apiRegions[0], alternate] } }));
  await page.route('**/backend/services', (route) => route.fulfill({ json: backendServices([{ ...apiService, location: { ...apiService.location, region_code: alternate.code } }]) }));
  await page.route('**/backend/metrics/**', (route) => route.fulfill({ json: apiMetrics }));
  await page.goto('/pesquisa');
  await page.getByLabel('País', { exact: true }).fill('Brasil');
  await page.getByLabel('Cidade', { exact: true }).selectOption(alternate.code);
  await expect(page.locator('.region-facts')).toContainText('150 gCO₂e/kWh');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page).toHaveURL(/regiao=br-alternate/);
});

test('carousel has no pause control and respects reduced motion', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const first = await page.locator('.hero__background.active').getAttribute('style');
  await expect(page.locator('.carousel-pause')).toHaveCount(0);
  await page.clock.fastForward(6_000);
  await expect(page.locator('.hero__background.active')).not.toHaveAttribute('style', first!);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await page.locator('.hero__background.active').getAttribute('style');
  await page.clock.fastForward(12_000);
  await expect(page.locator('.hero__background.active')).toHaveAttribute('style', reduced!);
});
