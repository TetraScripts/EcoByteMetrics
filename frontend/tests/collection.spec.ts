import { test, expect, apiService, apiRegions, apiMetrics, backendServices } from './fixtures';
import { getMonitoringSnapshot } from '../src/services/monitoring';
import { commonCollectionPoints } from '../src/utils/history';

test('backend timestamps remain authoritative and group unequal service completion times', async () => {
  const original = globalThis.fetch;
  const first = '2026-10-13T12:00:00Z', second = '2026-10-13T12:00:02Z';
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/services')) return Response.json(backendServices([apiService, { ...apiService, id: 'second' }]));
    if (url.endsWith('/regions')) return Response.json({ regions: apiRegions });
    expect(url).toMatch(/^\/backend\/metrics\//);
    return Response.json({ ...apiMetrics, collectedAt: url.endsWith('/second') ? second : first });
  };
  try {
    const snapshot = await getMonitoringSnapshot();
    expect(snapshot.history.map(point => point.collectedAt)).toEqual([first, second]);
    expect(snapshot.lastCollectionAt).toBe(second);
    expect(commonCollectionPoints(snapshot.history, ['billing-api', 'second'])).toHaveLength(2);
  } finally { globalThis.fetch = original; }
});

test('absent, malformed and timezone-free timestamps never create observations', async () => {
  const original = globalThis.fetch;
  try {
    for (const collectedAt of [null, 'not-a-date', '2026-10-13T12:00:00']) {
      globalThis.fetch = async (input) => Response.json(String(input).endsWith('/services') ? backendServices([apiService]) : String(input).endsWith('/regions') ? { regions: apiRegions } : { ...apiMetrics, collectedAt });
      const snapshot = await getMonitoringSnapshot();
      expect(snapshot.lastCollectionAt).toBeNull();
      expect(snapshot.history).toEqual([]);
      expect(snapshot.services[0].status).toBe('no-metrics');
    }
  } finally { globalThis.fetch = original; }
});

test.fixme('failed automatic refresh preserves the last successful timestamp and history [Sprint 2]', async ({ page }) => {
  await page.clock.install();
  const stamp = new Date().toISOString();
  let failed = false, calls = 0;
  await page.route('**/backend/services', route => route.fulfill({ json: backendServices([apiService]) }));
  await page.route('**/backend/metrics/**', route => {
    calls++;
    return route.fulfill(failed ? { status: 504, json: { error: 'metrics_timeout' } } : { json: { ...apiMetrics, collectedAt: stamp } });
  });
  await page.goto('/servicos/billing-api');
  const last = page.locator('.api-details div').filter({ has: page.getByText('Última coleta válida', { exact: true }) }).locator('dd');
  await expect(last).not.toContainText('Ainda sem');
  const previous = await last.innerText();
  failed = true;
  await page.clock.fastForward(30000);
  await expect.poll(() => calls).toBeGreaterThan(1);
  await expect(page.getByText('Indisponível', { exact: true })).toBeVisible();
  await expect(last).toHaveText(previous);
  await expect(page.locator('.connection-strip')).toHaveCount(0);
  await expect(page.locator('.trend-chart-populated')).toBeVisible();
});


test('monitoring works when randomUUID is unavailable on an HTTP network origin', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined, configurable: true }));
  await page.route('**/backend/services', route => route.fulfill({ json: backendServices([apiService]) }));
  await page.route('**/backend/metrics/**', route => route.fulfill({ json: apiMetrics }));
  await page.goto('/dashboard');
  await expect(page.locator('.connection-strip')).toHaveCount(0);
  await expect(page.locator('.metric-value').first()).not.toHaveText('—gCO₂e');
});
