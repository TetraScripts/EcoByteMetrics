import { test, expect, apiMetrics, apiRegions, apiService, backendServices } from './fixtures';
import { estimateEnergy, getMonitoringSnapshot } from '../src/services/monitoring';
import { findCountry, getCities } from '../src/data/geography';

test('adapter uses regional codes, actual intervals and localized API locations', async () => {
  const original = globalThis.fetch;
  const requested: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input); requested.push(url);
    return Response.json(url.endsWith('/regions') ? { regions: apiRegions } : url.endsWith('/services') ? backendServices([apiService]) : apiMetrics);
  };
  try {
    const snapshot = await getMonitoringSnapshot();
    expect(requested).toContain('/backend/services');
    expect(requested).not.toContain('https://metrics.unilaunch.org/services');
    expect(requested).toContain('/backend/metrics/billing-api');
    expect(snapshot.regions).toHaveLength(5);
    expect(snapshot.regions[4].city).toBe('Tóquio');
    expect(findCountry(snapshot.regions[1].country)?.properties.code).toBe('US');
    expect(getCities('US', snapshot.regions).map((city) => city.name)).toEqual(['Ashburn']);
    const service = snapshot.services[0];
    expect(service.country).toBe('Brasil');
    expect(service.city).toBe('São Paulo');
    expect(service.regionCode).toBe('br-sudeste');
    expect(service.carbonIntensity).toBe(85);
    expect(service.renewablePercent).toBe(83);
    expect(service.energyKwh).toBeCloseTo(50.87 / 60 / 1000, 10);
    expect(service.emissionsG).toBeCloseTo(0.0720658333333, 10);
    expect(estimateEnergy(50, 2, 10, 1, 30)).toBeCloseTo(service.energyKwh! / 2, 10);
    expect(snapshot.history[0].regionCode).toBe('br-sudeste');
    expect(snapshot.history[0].country).toBe('Brasil');
  } finally { globalThis.fetch = original; }
});

test('adapter distinguishes unavailable, missing, removed and valid zero metrics', async () => {
  const original = globalThis.fetch;
  const ids = ['zero', 'unavailable', 'missing', 'removed', 'partial'];
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/services')) return Response.json(backendServices(ids.map((id) => ({ ...apiService, id }))));
    if (url.endsWith('/regions')) return Response.json({ regions: apiRegions });
    const id = url.split('/').at(-1);
    if (id === 'unavailable') return Response.json({ error: 'service_unavailable' }, { status: 500 });
    if (id === 'missing') return Response.json({ error: 'metrics_missing' }, { status: 500 });
    if (id === 'removed') return Response.json({ error: 'service_not_found' }, { status: 404 });
    if (id === 'partial') return Response.json({ ...apiMetrics, metrics: { ...apiMetrics.metrics, cpu_percent: 101 } });
    return Response.json({ collectedAt: new Date().toISOString(), collection_interval_seconds: 0, metrics: { cpu_percent: 0, memory_gb: 0, disk_gb: 0, network_gb: 0 } });
  };
  try {
    const snapshot = await getMonitoringSnapshot();
    expect(snapshot.services.map((service) => service.status)).toEqual(['available', 'unavailable', 'no-metrics', 'removed', 'no-metrics']);
    expect(snapshot.services[0].energyKwh).toBe(0);
    expect(snapshot.services[0].emissionsG).toBe(0);
    expect(snapshot.services.slice(1).every((service) => service.emissionsG === null)).toBe(true);
    expect(snapshot.history).toHaveLength(1);
  } finally { globalThis.fetch = original; }
});

test('carbon failure preserves energy without inventing an emission factor', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    return url.endsWith('/regions') ? Response.json({ error: 'unavailable' }, { status: 503 }) : Response.json(url.endsWith('/services') ? backendServices([apiService]) : apiMetrics);
  };
  try {
    const snapshot = await getMonitoringSnapshot();
    expect(snapshot.warning).toContain('fatores de carbono');
    expect(snapshot.regions).toEqual([]);
    expect(snapshot.services[0].status).toBe('available');
    expect(snapshot.totalEnergyKwh).toBeGreaterThan(0);
    expect(snapshot.totalEmissionsG).toBeNull();
    expect(snapshot.history[0].emissionsG).toBeNull();
  } finally { globalThis.fetch = original; }
});

test('live mode offers only registered cities and shows the selected regional factor', async ({ page }, testInfo) => {
  test.slow();
  await page.route(/\/backend\/(?:services$|metrics\/)/, (route) => route.fulfill({ json: route.request().url().endsWith('/services') ? backendServices([apiService]) : apiMetrics }));
  await page.goto('/pesquisa');
  await expect(page.getByLabel('Usar dados de demonstração')).toHaveCount(0);
  await page.getByLabel('País', { exact: true }).fill('Brasil');
  await expect(page.getByRole('button', { name: 'São Paulo', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rio de Janeiro', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'São Paulo', exact: true }).click();
  await expect(page.locator('.region-facts')).toContainText('85 gCO₂e/kWh');
  await expect(page.locator('.region-facts')).toContainText('83%');
  await page.getByLabel('País', { exact: true }).fill('França');
  await expect(page.getByText('Nenhuma região cadastrada para este país na consulta atual.')).toBeVisible();
  await page.getByLabel('País', { exact: true }).fill('Japão');
  await page.getByRole('button', { name: 'Tóquio', exact: true }).click();
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.locator('.research-form').getByRole('status')).toContainText('sem serviços monitorados');
  await page.getByLabel('País', { exact: true }).fill('Brasil');
  await page.getByRole('button', { name: 'São Paulo', exact: true }).click();
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page).toHaveURL(/regiao=br-sudeste/);
  await expect(page.getByText('Fatores de carbono por região', { exact: true })).toHaveCount(0);
  await expect(page.locator('.renewable-summary')).toContainText('83%');
  await expect(page.locator('.metric-value').first()).not.toHaveText('—gCO₂e');
  await page.screenshot({ path: testInfo.outputPath('api-dashboard.png'), fullPage: true, animations: 'disabled' });
});

test.fixme('polling discovers removals and new services and preserves data during an outage [Sprint 2]', async ({ page }) => {
  await page.clock.install();
  let summaries = [apiService];
  let outage = false;
  await page.route(/\/backend\/(?:services$|metrics\/)/, (route) => {
    if (route.request().url().endsWith('/services')) return route.fulfill({ status: outage ? 503 : 200, json: outage ? { error: 'unavailable' } : backendServices(summaries) });
    return route.fulfill({ json: apiMetrics });
  });
  await page.goto('/servicos');
  await expect(page.getByText('Billing API', { exact: true })).toBeVisible();
  await expect(page.locator('tbody tr').first()).toContainText('Disponível');
  summaries = [{ ...apiService, id: 'new-worker', name: 'New Worker' }];
  await page.clock.fastForward(30_001);
  await expect(page.getByText('New Worker', { exact: true })).toBeVisible();
  await expect(page.locator('tbody tr').filter({ hasText: 'Billing API' })).toContainText('Removido');
  outage = true;
  await page.clock.fastForward(30_001);
  await expect(page.getByRole('alert')).toContainText('últimos dados recebidos foram preservados');
  await expect(page.getByText('New Worker', { exact: true })).toBeVisible();
  outage = false;
  await page.clock.fastForward(30_001);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
