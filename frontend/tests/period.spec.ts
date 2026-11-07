import { test, expect, apiService, apiMetrics, backendServices } from './fixtures';
import { analysisQuery, getAnalysis, isPeriod } from '../src/utils/analysis';
import { getTestSnapshot } from './data/monitoring';

test('24 hours and 7 days select different historical observations', () => {
  const snapshot = getTestSnapshot('7d');
  snapshot.lastCollectionAt = '2026-10-13T12:00:00Z';
  snapshot.history = [
    { serviceId: 'demo-br', collectedAt: '2026-10-03T12:00:00Z', energyKwh: 1, emissionsG: 85 },
    { serviceId: 'demo-br', collectedAt: '2026-10-11T12:00:00Z', energyKwh: 2, emissionsG: 170 },
    { serviceId: 'demo-br', collectedAt: '2026-10-13T12:00:00Z', energyKwh: 3, emissionsG: 255 },
  ];
  expect(getAnalysis(snapshot, '24h', '').totals.energyKwh).toBe(3);
  expect(getAnalysis(snapshot, '7d', '').totals.energyKwh).toBe(5);
  expect(getAnalysis(snapshot, '7d', '?ate=2026-10-04T12:00').history).toHaveLength(1);
});

test('unsupported periods are excluded from analysis links', () => {
  expect(isPeriod('24h')).toBe(true);
  expect(isPeriod('7d')).toBe(true);
  expect(isPeriod('30d')).toBe(false);
  expect(analysisQuery('?periodo=30d&regiao=br-sudeste').toString()).toBe('regiao=br-sudeste');
});

test('old 30-day preferences fall back to 7 days and preserve motion settings', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ecobytemetrics.preferences.v1', JSON.stringify({
    parallaxEnabled: false, defaultPeriod: '30d',
  })));
  await page.goto('/dashboard?periodo=30d');
  await expect(page.getByLabel('Período de análise')).toHaveValue('7d');
  await expect(page.locator('.analysis-context')).toContainText('Últimos 7 dias');
  await expect(page.locator('.leaf-scene')).toHaveClass(/leaf-scene-static/);
});

test.fixme('period changes refresh resources and preserve location without diagnostic notes [Sprint 2]', async ({ page }) => {
  let calls = 0;
  let cpu = 50;
  await page.route('**/backend/services', route => { calls++; return route.fulfill({ json: backendServices([apiService]) }); });
  await page.route('**/backend/metrics/**', route => route.fulfill({ json: { ...apiMetrics, metrics: { ...apiMetrics.metrics, cpu_percent: cpu } } }));
  await page.goto('/servicos?regiao=br-sudeste');
  await expect(page.locator('tbody tr').first()).toContainText('50%');
  const select = page.getByLabel('Período de análise');
  cpu = 80;
  await select.selectOption('24h');
  await expect(select).toHaveValue('24h');
  await expect.poll(() => calls).toBe(2);
  await expect(page.locator('tbody tr').first()).toContainText('80%');
  await expect(page.locator('.analysis-context')).toContainText('Últimas 24 horas');
  await expect(page.locator('.period-coverage, .source-note')).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get('regiao')).toBe('br-sudeste');
  cpu = 90;
  await select.selectOption('7d');
  await expect(select).toHaveValue('7d');
  await expect.poll(() => calls).toBe(3);
  await expect(page.locator('tbody tr').first()).toContainText('90%');
  await expect(page.locator('.analysis-context')).toContainText('Últimos 7 dias');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
