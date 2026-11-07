import { test, expect, apiRegions, backendServices } from './fixtures';
import type { CollectionPoint } from '../src/types/monitoring';
import { rankServiceImpact } from '../src/utils/serviceImpact';
import { getAnalysis } from '../src/utils/analysis';
import { getTestSnapshot } from './data/monitoring';

const stamp = '2026-10-17T12:00:00Z';
const point = (serviceId: string, energyKwh: number, emissionsG: number | null, collectedAt = stamp): CollectionPoint => ({
  serviceId, energyKwh, emissionsG, collectedAt, regionCode: 'br-sudeste', intervalSeconds: 60,
});

test('impact ranks services across samples, deduplicates cached samples and retains real zero values', () => {
  const history = [point('a', 3, 6), point('a', 4, 8, '2026-10-17T12:01:00Z'), point('b', 5, 20), point('zero', 0, 0), point('a', 3, 6)];
  const services = [{ id: 'a', name: 'API A' }, { id: 'b', name: 'API B' }, { id: 'zero', name: 'Zero' }];
  const energy = rankServiceImpact(history, services, 'energy');
  expect(energy.entries.map(entry => [entry.id, entry.value])).toEqual([['a', 7], ['b', 5], ['zero', 0]]);
  expect(energy.entries[0].count).toBe(2);
  expect(energy.entries[0].seconds).toBe(120);
  expect(rankServiceImpact(history, services, 'emissions').entries.map(entry => entry.id)).toEqual(['b', 'a', 'zero']);
});

test('incomplete emissions are excluded from ordering and identical names remain distinct services', () => {
  const services = [{ id: 'a', name: 'API' }, { id: 'b', name: 'API' }];
  const history = [point('a', 1, 1), point('a', 1, null, '2026-10-17T12:01:00Z'), point('b', 2, 2), point('historical', 0, 0)];
  const energy = rankServiceImpact(history, services, 'energy');
  expect(energy.entries.map(entry => entry.id)).toEqual(['a', 'b', 'historical']);
  const emissions = rankServiceImpact(history, services, 'emissions');
  expect(emissions.omittedCount).toBe(1);
  expect(emissions.entries.map(entry => entry.id)).toEqual(['b', 'historical']);
  expect(emissions.entries[1].name).toBe('historical');
  expect(rankServiceImpact([point('a', 1, null)], services, 'emissions')).toEqual({ entries: [], omittedCount: 1 });
  expect(rankServiceImpact([], services, 'energy').entries).toEqual([]);
});

test('impact respects selected region, period and historical date', () => {
  const base = getTestSnapshot('7d');
  const anchor = new Date(2026, 9, 17, 12).getTime();
  const recent = new Date(anchor).toISOString(), old = new Date(anchor - 48 * 3600_000).toISOString();
  const snapshot = { ...base, regions: [], lastCollectionAt: recent, services: [
    { ...base.services[0], id: 'a', name: 'API A', regionCode: 'br-sudeste' },
    { ...base.services[0], id: 'b', name: 'API B', regionCode: 'br-sudeste' },
  ], history: [point('a', 20, 20, old), point('a', 1, 1, recent), point('b', 2, 2, recent), { ...point('foreign', 100, 100, recent), regionCode: 'us-east' }] };
  const ranking = (period: '24h' | '7d', search: string) => rankServiceImpact(getAnalysis(snapshot, period, search).history, snapshot.services, 'energy');
  expect(ranking('24h', 'regiao=br-sudeste').entries.map(entry => entry.id)).toEqual(['b', 'a']);
  expect(ranking('7d', 'regiao=br-sudeste').entries.map(entry => [entry.id, entry.value])).toEqual([['a', 21], ['b', 2]]);
  expect(ranking('24h', 'regiao=br-sudeste&ate=2026-10-15T12:01').entries.map(entry => [entry.id, entry.value])).toEqual([['a', 20]]);
});

test('dashboard shows current resources and ranks service impact in either metric', async ({ page }, testInfo) => {
  const definitions = [
    { id: 'compute', name: 'Compute API', cpu: 80, region: apiRegions[0] },
    { id: 'worker', name: 'Worker', cpu: 20, region: apiRegions[1] },
    { id: 'unknown', name: 'Sem fator', cpu: 100, region: { ...apiRegions[0], code: 'unknown-region' } },
    { id: 'zero', name: 'Zero', cpu: 0, region: apiRegions[0] },
  ];
  const collectedAt = new Date().toISOString();
  await page.route('**/backend/services', route => route.fulfill({ json: backendServices(definitions.map(service => ({
    id: service.id, name: service.name, location: { ...service.region, region_code: service.region.code },
  }))) }));
  await page.route('**/backend/metrics/**', route => {
    const service = definitions.find(entry => entry.id === route.request().url().split('/').at(-1))!;
    return route.fulfill({ json: { serviceId: service.id, updatedAt: collectedAt, metrics: {
      collection_interval_seconds: 60, metrics: { cpu_percent: service.cpu, memory_gb: 0, disk_gb: 0, network_gb: 0 },
    } } });
  });
  await page.goto('/dashboard');
  const ranking = page.locator('.service-impact-ranking');
  const names = ranking.locator('.service-impact-label > strong');
  await expect(names).toHaveText(['Sem fator', 'Compute API', 'Worker', 'Zero']);
  const compute = page.getByRole('region', { name: 'Localização e coleta por serviço' }).getByRole('row', { name: /Compute API/ });
  await expect(compute.locator('[data-label="Recursos atuais"]')).toContainText('80 %');
  await expect(compute.locator('[data-label="Recursos atuais"]')).toContainText('0 GB');
  await expect(compute.locator('[data-label="Impacto da amostra"]')).toContainText('0,001333 kWh');
  const missing = page.getByRole('region', { name: 'Localização e coleta por serviço' }).getByRole('row', { name: /Sem fator/ });
  await expect(missing.locator('[data-label="Impacto da amostra"]')).toContainText('—');
  await ranking.getByLabel('Ordenar ranking por').selectOption('emissions');
  await expect(names).toHaveText(['Worker', 'Compute API', 'Zero']);
  await expect(ranking).toContainText('1 serviço sem emissões completas');
  await expect(ranking.locator('.service-impact-value').last()).toHaveText('0 gCO₂e');
  await ranking.screenshot({ path: testInfo.outputPath('service-impact.png'), style: '.skip-link:not(:focus) { visibility: hidden; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/dashboard?regiao=br-sudeste');
  await expect(names).toHaveText(['Compute API', 'Zero']);
});

test('partial samples retain available resources and never show missing estimates as zero', async ({ page }, testInfo) => {
  await page.route('**/backend/services', route => route.fulfill({ json: backendServices([
    { id: 'partial', name: 'Partial API', location: { ...apiRegions[0], region_code: apiRegions[0].code } },
  ]) }));
  await page.route('**/backend/metrics/**', route => route.fulfill({ json: {
    collectedAt: new Date().toISOString(), collection_interval_seconds: 60,
    metrics: { cpu_percent: 50, memory_gb: null, disk_gb: 10, network_gb: 1 },
  } }));
  await page.goto('/dashboard');
  const row = page.getByRole('region', { name: 'Localização e coleta por serviço' }).getByRole('row', { name: /Partial API/ });
  await expect(row).toContainText('Métricas parciais');
  const resources = row.locator('[data-label="Recursos atuais"]');
  await expect(resources).toContainText('50 %');
  await expect(resources).toContainText('10 GB');
  await expect(resources.getByText('RAM', { exact: true }).locator('..').locator('dd')).toHaveText('—');
  await expect(row.locator('[data-label="Impacto da amostra"] dd')).toHaveText(['—', '—']);
  const ranking = page.locator('.service-impact-ranking');
  await expect(ranking).toContainText('Sem coletas válidas neste período.');
  await expect(ranking.locator('li')).toHaveCount(0);
  await ranking.getByLabel('Ordenar ranking por').selectOption('emissions');
  await expect(ranking).toContainText('Emissões indisponíveis neste período.');
  await page.locator('.service-collection-panel').screenshot({ path: testInfo.outputPath('service-resources.png'), style: '.skip-link:not(:focus) { visibility: hidden; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
