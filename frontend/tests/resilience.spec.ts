import { test, expect, apiMetrics, apiRegions, apiService, backendServices } from './fixtures';
import { getMonitoringSnapshot } from '../src/services/monitoring';
import { getSelectableRegions } from '../src/utils/researchRegions';

test('missing geography never prevents collecting otherwise valid service metrics', async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  const places = [
    { ...apiService.location, latitude: null },
    { ...apiService.location, latitude: 100, longitude: 300 },
    { ...apiService.location, country: null, region: null, city: 42 },
  ];
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.endsWith('/regions')) return Response.json({ regions: apiRegions });
    if (url.endsWith('/services')) return Response.json(backendServices(places.map((location, i) => ({ ...apiService, id: 'service-' + i, location }))));
    calls.push(url);
    return Response.json(apiMetrics);
  };
  try {
    const snapshot = await getMonitoringSnapshot();
    expect(calls).toHaveLength(3);
    expect(snapshot.services.map(service => service.status)).toEqual(['available', 'available', 'available']);
    expect(snapshot.services[0]).toMatchObject({ country: 'Brasil', region: 'Sudeste', city: 'São Paulo' });
    expect(snapshot.services[0].latitude).toBeUndefined();
    expect(snapshot.services[0].longitude).toBeUndefined();
    expect(snapshot.services[1].latitude).toBeUndefined();
    expect(snapshot.services[2].country).toBeNull();
    expect(snapshot.services[2].city).toBeNull();
    expect(snapshot.history).toHaveLength(3);
    expect(snapshot.totalEnergyKwh).toBeGreaterThan(0);
    expect(snapshot.totalEmissionsG).toBeGreaterThan(0);
    const catalog = getSelectableRegions({ ...snapshot, regions: [] });
    expect(catalog).toHaveLength(1);
    expect(catalog[0].city).toBe('São Paulo');
    expect(catalog[0]).not.toHaveProperty('carbonIntensity');
  } finally { globalThis.fetch = original; }
});

test('carbon factors do not depend on reference coordinates', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async input => Response.json(String(input).endsWith('/services')
    ? backendServices([apiService])
    : String(input).endsWith('/regions')
      ? { regions: [{ ...apiRegions[0], latitude: null, longitude: null }] }
      : apiMetrics);
  try {
    const snapshot = await getMonitoringSnapshot();
    expect(snapshot.regions).toHaveLength(1);
    expect(snapshot.totalEmissionsG).toBeGreaterThan(0);
  } finally { globalThis.fetch = original; }
});

test('research works during a carbon outage with no coordinates and recovers emission factors', async ({ page }) => {
  let offline = true;
  const stamp = new Date().toISOString();
  const service = { ...apiService, location: { ...apiService.location, latitude: null, longitude: null } };
  await page.route('**/backend/services', route => route.fulfill({ json: backendServices([service]) }));
  await page.route('**/backend/metrics/**', route => route.fulfill({ json: { ...apiMetrics, collectedAt: stamp } }));
  await page.route('https://carbon.unilaunch.org/**', route => route.fulfill(offline
    ? { status: 503, json: { error: 'unavailable' } }
    : { json: { regions: apiRegions } }));
  await page.goto('/pesquisa');
  await page.getByLabel('País', { exact: true }).fill('Brasil');
  const city = page.getByLabel('Cidade', { exact: true });
  await expect(city).toBeEnabled();
  await city.selectOption('br-sudeste');
  await expect(page.locator('.region-facts')).toContainText('Indisponível');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Fator de carbono');
  await page.getByRole('button', { name: 'Ver dashboard', exact: true }).click();
  await expect(page).toHaveURL(/dashboard.*regiao=br-sudeste/);
  await expect(page.locator('.metric-value').nth(1)).not.toContainText('—');
  const energy = (await page.locator('.metric-value').nth(1).textContent())!;
  await expect(page.locator('.metric-value').first()).toContainText('—');
  await expect(page.locator('.globe-map')).toHaveAttribute('data-read-only', 'true');
  const row = page.getByRole('region', { name: 'Localização e coleta por serviço' }).getByRole('row', { name: /Billing API/ });
  await expect(row).toContainText('São Paulo');
  await expect(row).toContainText('Disponível');
  await page.getByRole('link', { name: 'Pesquisar outra região', exact: true }).click();
  await expect(city).toHaveValue('br-sudeste');
  offline = false;
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page).toHaveURL(/dashboard.*regiao=br-sudeste/);
  await expect(page.locator('.metric-value').first()).not.toContainText('—');
  await expect(page.locator('.metric-value').nth(1)).toHaveText(energy);
});

test('a carbon outage during search preserves an existing region code even if its reference city changes', async ({ page }) => {
  let offline = false;
  await page.route('**/backend/services', route => route.fulfill({ json: backendServices([{ ...apiService, location: { ...apiService.location, city: 'Campinas' } }]) }));
  await page.route('**/backend/metrics/**', route => route.fulfill({ json: apiMetrics }));
  await page.route('https://carbon.unilaunch.org/**', route => offline ? route.abort('connectionrefused') : route.fulfill({ json: { regions: apiRegions } }));
  await page.goto('/pesquisa');
  await page.getByLabel('País', { exact: true }).fill('Brasil');
  await page.getByLabel('Cidade', { exact: true }).selectOption('br-sudeste');
  offline = true;
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Fator de carbono');
  await page.getByRole('button', { name: 'Ver dashboard', exact: true }).click();
  await expect(page).toHaveURL(/regiao=br-sudeste/);
  await expect(page.locator('.analysis-context')).toContainText('Campinas');
});

test('carbon failure does not bypass unavailable service discovery', async ({ page }) => {
  await page.route('https://carbon.unilaunch.org/**', route => route.fulfill({ status: 503, json: {} }));
  await page.route('**/backend/services', route => route.fulfill({ status: 502, json: {} }));
  await page.goto('/pesquisa');
  await expect(page.getByRole('alert').filter({ hasText: 'HTTP 502' })).toBeVisible();
  await page.getByLabel('País', { exact: true }).fill('Brasil');
  await expect(page.getByLabel('Cidade', { exact: true })).toBeDisabled();
  await expect(page).toHaveURL(/pesquisa/);
});

test('a service with only country and regional code remains selectable without inventing a city', async ({ page }) => {
  await page.route('https://carbon.unilaunch.org/**', route => route.fulfill({ status: 503, json: {} }));
  await page.route('**/backend/services', route => route.fulfill({ json: backendServices([
    { ...apiService, location: { country: 'Brazil', region_code: 'br-sudeste' } },
  ]) }));
  await page.route('**/backend/metrics/**', route => route.fulfill({ json: apiMetrics }));
  await page.goto('/pesquisa');
  await page.getByLabel('País', { exact: true }).fill('Brasil');
  await page.getByLabel('Cidade', { exact: true }).selectOption('br-sudeste');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: 'Ver dashboard', exact: true }).click();
  await expect(page).toHaveURL(/regiao=br-sudeste/);
  await expect(page.getByRole('region', { name: 'Localização e coleta por serviço' })).toContainText('Cidade não informada');
  await expect(page.locator('.metric-value').nth(1)).not.toContainText('—');
});
