import { test, expect, apiMetrics, apiRegions, apiService, backendServices } from './fixtures';
import { getMonitoringSnapshot } from '../src/services/monitoring';
import { mergeCollectionHistory } from '../src/utils/history';

const stamp = '2026-10-17T12:00:00.000Z';
const cachedMetrics = {
  serviceId: apiService.id,
  metrics: {
    collection_interval_seconds: 60,
    metrics: { cpu_percent: 50, memory_gb: 2, disk_gb: 10, network_gb: 1 },
  },
  updatedAt: stamp,
};

async function snapshotWith(payload: unknown, status = 200) {
  const original = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.endsWith('/services')) return Response.json(backendServices([apiService]));
    if (url.endsWith('/regions')) return Response.json({ regions: apiRegions });
    return Response.json(payload, { status });
  };
  try { return await getMonitoringSnapshot(); }
  finally { globalThis.fetch = original; }
}

test('develop metrics envelope preserves resources, interval and backend timestamp', async () => {
  const snapshot = await snapshotWith(cachedMetrics);
  expect(snapshot.services[0]).toMatchObject({
    status: 'available', cpuPercent: 50, memoryGb: 2, diskGb: 10, networkGb: 1,
    collectionIntervalSeconds: 60, lastCollectionAt: stamp,
  });
  expect(snapshot.totalEnergyKwh).toBeCloseTo(0.000847833333333, 12);
  expect(snapshot.totalEmissionsG).toBeCloseTo(0.072065833333333, 12);
  expect(snapshot.history).toHaveLength(1);
  expect(snapshot.history[0].collectedAt).toBe(stamp);
});

test('cached metrics reject missing timestamps, mismatched services and incomplete values', async () => {
  for (const updatedAt of [null, 'invalid', '2026-10-17T12:00:00']) {
    const snapshot = await snapshotWith({ ...cachedMetrics, updatedAt });
    expect(snapshot.services[0].status).toBe('no-metrics');
    expect(snapshot.history).toEqual([]);
  }
  const wrongService = await snapshotWith({ ...cachedMetrics, serviceId: 'another-service' });
  expect(wrongService.services[0].status).toBe('no-metrics');
  expect(wrongService.history).toEqual([]);
  const partial = await snapshotWith({ ...cachedMetrics, metrics: {
    ...cachedMetrics.metrics, metrics: { ...cachedMetrics.metrics.metrics, memory_gb: null },
  } });
  expect(partial.services[0].status).toBe('no-metrics');
  expect(partial.services[0].cpuPercent).toBe(50);
  expect(partial.history).toEqual([]);
});

test('a listed service without cached metrics is not treated as removed', async () => {
  const snapshot = await snapshotWith({
    error: 'Métricas não encontradas para este serviço.', serviceId: apiService.id,
  }, 404);
  expect(snapshot.services[0].status).toBe('no-metrics');
  expect(snapshot.history).toEqual([]);
  const removed = await snapshotWith({ error: 'service_not_found' }, 404);
  expect(removed.services[0].status).toBe('removed');
});

test('legacy responses retain their explicit collection timestamp', async () => {
  const snapshot = await snapshotWith({ ...apiMetrics, collectedAt: stamp });
  expect(snapshot.services[0].status).toBe('available');
  expect(snapshot.lastCollectionAt).toBe(stamp);
});

test('cached observations are unique per service and instant across polling cycles', () => {
  const point = { serviceId: apiService.id, collectedAt: stamp, cycleId: 'old', energyKwh: 1, emissionsG: 85 };
  const history = mergeCollectionHistory([point], [
    { ...point, collectedAt: '2026-10-17T09:00:00-03:00', cycleId: 'new' },
    { ...point, serviceId: 'another-service', cycleId: 'new' },
    { ...point, collectedAt: '2026-10-17T12:00:30.000Z', cycleId: 'new' },
  ]);
  expect(history).toHaveLength(3);
  expect(history[0]).toEqual(point);
});

test('recovered carbon data completes a cached observation without changing known emissions or energy', () => {
  const point = { serviceId: apiService.id, regionCode: 'br-sudeste', collectedAt: stamp, intervalSeconds: 60, cycleId: 'old', energyKwh: 0.01, emissionsG: null };
  const recovered = { ...point, cycleId: 'new', emissionsG: 0.85 };
  const history = mergeCollectionHistory([point], [recovered]);
  expect(history).toEqual([{ ...point, emissionsG: 0.85 }]);
  expect(mergeCollectionHistory(history, [{ ...recovered, emissionsG: 2 }])).toEqual(history);
  expect(mergeCollectionHistory([point], [{ ...recovered, energyKwh: 0.02 }])).toEqual([point]);
  expect(mergeCollectionHistory([point], [{ ...recovered, regionCode: 'us-east' }])).toEqual([point]);
});

test('dashboard polling does not count cached samples twice and accepts a new sample', async ({ page }) => {
  await page.clock.install();
  let calls = 0;
  let updatedAt = new Date().toISOString();
  await page.route('**/backend/services', route => route.fulfill({ json: backendServices([apiService]) }));
  await page.route('**/backend/metrics/**', route => {
    calls++;
    return route.fulfill({ json: { ...cachedMetrics, updatedAt } });
  });
  await page.goto('/dashboard?regiao=br-sudeste');
  const energy = page.locator('.metric-value').nth(1);
  await expect(energy).not.toContainText('—');
  const first = (await energy.textContent())!;
  const firstCalls = calls;
  await page.clock.fastForward(30_001);
  await expect.poll(() => calls).toBeGreaterThan(firstCalls);
  await expect(energy).toHaveText(first);
  updatedAt = new Date(Date.parse(updatedAt) + 30_000).toISOString();
  await page.clock.fastForward(30_001);
  await expect.poll(() => calls).toBeGreaterThan(firstCalls + 1);
  await expect(energy).not.toHaveText(first);
});
