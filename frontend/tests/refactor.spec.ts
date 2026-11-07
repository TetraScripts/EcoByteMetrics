import { test, expect, apiService, apiMetrics, backendServices } from './fixtures';
import { parseLocalDate, getAnalysis } from '../src/utils/analysis';
import { aggregateCollections, commonCollectionPoints } from '../src/utils/history';
import { formatNumber } from '../src/utils/format';
import { getTestSnapshot } from './data/monitoring';

test('local date filters reject impossible calendar dates and preserve leap days', () => {
  for (const date of ['2026-02-30T12:00', '2026-02-29T12:00', '2026-04-31T12:00', '2026-13-01T12:00', '2026-10-14T24:00']) expect(Number.isNaN(parseLocalDate(date))).toBe(true);
  expect(Number.isFinite(parseLocalDate('2024-02-29T12:00:01'))).toBe(true);
  expect(getAnalysis(getTestSnapshot('7d'), '7d', '?ate=2026-02-30T12:00').invalidDate).toBe(true);
});

test('filtered cycle labels stay within the selected date and distinguish separate requests', () => {
  const snapshot = getTestSnapshot('7d');
  snapshot.history = [
    { serviceId: 'a', cycleId: 'one', collectedAt: '2026-10-13T12:00:00-03:00', cycleAt: '2026-10-13T12:00:02-03:00', energyKwh: 1, emissionsG: 1 },
    { serviceId: 'b', cycleId: 'one', collectedAt: '2026-10-13T12:00:02-03:00', energyKwh: 2, emissionsG: 2 },
    { serviceId: 'a', cycleId: 'two', collectedAt: '2026-10-13T12:00:00-03:00', energyKwh: 3, emissionsG: null },
  ];
  const analysis = getAnalysis(snapshot, '7d', '?ate=2026-10-13T12:00:01');
  const series = aggregateCollections(analysis.history, 'energy');
  expect(series).toHaveLength(2);
  expect(series.every(point => Date.parse(point.collectedAt) <= analysis.windowEnd!)).toBe(true);
  expect(commonCollectionPoints(snapshot.history, ['a', 'b']).map(point => point.cycleId)).toEqual(['one', 'one']);
});

test('number formatters retain precision and reject nonfinite values', () => {
  expect(formatNumber(0)).toBe('0');
  expect(formatNumber(1234.56789)).toBe('1.234,5679');
  expect(formatNumber(0.000072065)).toBe('0,00007207');
  expect(formatNumber(null)).toBe('—');
  expect(formatNumber(Infinity)).toBe('—');
});

test.fixme('collection details mount on demand and page through every retained observation [Sprint 2]', async ({ page }) => {
  test.slow();
  let calls = 0;
  const start = Date.now();
  await page.clock.install();
  await page.route('**/backend/services', route => route.fulfill({ json: backendServices([apiService]) }));
  await page.route('**/backend/metrics/**', route => route.fulfill({ json: { ...apiMetrics, collectedAt: new Date(start + calls++ * 1000).toISOString() } }));
  await page.goto('/emissoes');
  const collectionCount = page.locator('.metric-card').filter({ hasText: 'Coletas no período' }).locator('.metric-value');
  await expect(collectionCount).toHaveText('1');
  const period = page.getByRole('combobox', { name: 'Período de análise' });
  for (let i = 2; i <= 55; i++) {
    await period.selectOption(i % 2 ? '7d' : '24h');
    await expect(collectionCount).toHaveText(String(i));
  }
  const details = page.locator('.chart-data');
  await expect(details.locator('tbody tr')).toHaveCount(0);
  await details.locator('summary').click();
  await expect(details.locator('tbody tr')).toHaveCount(50);
  await details.getByRole('button', { name: 'Próxima página' }).click();
  await expect(details.locator('tbody tr')).toHaveCount(5);
  await expect(details.getByRole('status')).toContainText('Página 2 de 2 · 55 coletas');
  await details.getByRole('button', { name: 'Página anterior' }).click();
  await expect(details.locator('tbody tr')).toHaveCount(50);
  await details.locator('summary').click();
  await expect(details.locator('tbody tr')).toHaveCount(0);
});

test('mobile homepage uses smaller image assets', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Desktop retains the full-size photos.');
  await page.goto('/');
  await expect(page.locator('.hero__background.active')).toHaveCSS('background-image', /hero-lugano\.mobile/);
});
