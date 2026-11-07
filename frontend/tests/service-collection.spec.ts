import { test, expect, apiService, apiMetrics, backendServices } from './fixtures';

test('dashboard shows each service location, sample interval and backend timestamp', async ({ page }, testInfo) => {
  const first = '2026-10-17T12:00:00.000Z';
  const second = '2026-10-17T12:00:02.000Z';
  const services = [
    { ...apiService, location: { ...apiService.location, city: 'Campinas' } },
    { ...apiService, id: 'worker', name: 'Worker', location: { ...apiService.location, city: null } },
    { ...apiService, id: 'outside', name: 'Outside', location: { ...apiService.location, region_code: 'us-east' } },
  ];
  await page.route('**/backend/services', route => route.fulfill({ json: backendServices(services) }));
  await page.route('**/backend/metrics/**', route => {
    const id = route.request().url().split('/').at(-1)!;
    return route.fulfill({ json: {
      serviceId: id,
      metrics: { collection_interval_seconds: id === 'worker' ? 120 : 60, metrics: apiMetrics.metrics },
      updatedAt: id === 'worker' ? second : first,
    } });
  });
  await page.goto('/dashboard?regiao=br-sudeste');
  const summary = page.getByRole('region', { name: 'Localização e coleta por serviço' });
  await expect(summary).toBeVisible();
  const billing = summary.getByRole('row', { name: /Billing API/ });
  await expect(billing).toContainText('Brasil');
  await expect(billing).toContainText('Sudeste');
  await expect(billing).toContainText('Campinas');
  await expect(billing).not.toContainText('São Paulo');
  await expect(billing.locator('td[data-label="Intervalo da amostra"]')).toHaveText('60 s');
  await expect(billing.locator('time')).toHaveAttribute('datetime', first);
  await expect(billing.locator('time')).toHaveText(await page.evaluate(stamp => new Date(stamp).toLocaleString('pt-BR'), first));
  const worker = summary.getByRole('row', { name: /Worker/ });
  await expect(worker).toContainText('Cidade não informada');
  await expect(worker.locator('td[data-label="Intervalo da amostra"]')).toHaveText('120 s');
  await expect(worker.locator('time')).toHaveAttribute('datetime', second);
  await expect(summary.getByRole('row', { name: /Outside/ })).toHaveCount(0);
  await expect(summary.locator('td[data-label="Intervalo da amostra"]')).toHaveText(['60 s', '120 s']);
  await expect(page.locator('.globe-cities[aria-label="Serviços no mapa"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('.service-collection-panel').screenshot({
    path: testInfo.outputPath('service-collection.png'),
    // Mobile element captures can paint an offscreen fixed skip link over the panel.
    style: '.skip-link:not(:focus) { visibility: hidden; }',
  });
});

test('dashboard distinguishes zero interval from invalid or missing interval', async ({ page }) => {
  const ids = ['zero', 'invalid', 'missing'];
  await page.route('**/backend/services', route => route.fulfill({ json: backendServices(ids.map(id => ({ ...apiService, id, name: id }))) }));
  await page.route('**/backend/metrics/**', route => {
    const id = route.request().url().split('/').at(-1);
    return route.fulfill({ json: { ...apiMetrics, collection_interval_seconds: id === 'zero' ? 0 : id === 'invalid' ? -1 : null } });
  });
  await page.goto('/dashboard?regiao=br-sudeste');
  const summary = page.getByRole('region', { name: 'Localização e coleta por serviço' });
  await expect(summary.getByRole('row', { name: /^zero/ }).locator('td[data-label="Intervalo da amostra"]')).toHaveText('0 s');
  for (const id of ['invalid', 'missing']) {
    const row = summary.getByRole('row', { name: new RegExp('^' + id) });
    await expect(row).toContainText('Intervalo não informado');
    await expect(row).toContainText('Sem coleta válida');
    await expect(row.locator('time')).toHaveCount(0);
  }
});

test('a failed refresh preserves the last valid timestamp without inventing a sample interval', async ({ page }) => {
  await page.clock.install();
  const stamp = new Date().toISOString();
  let failed = false;
  let calls = 0;
  await page.route('**/backend/services', route => route.fulfill({ json: backendServices([apiService]) }));
  await page.route('**/backend/metrics/**', route => {
    calls++;
    return route.fulfill(failed ? { status: 503, json: { error: 'metrics_timeout' } } : { json: { ...apiMetrics, collectedAt: stamp } });
  });
  await page.goto('/dashboard?regiao=br-sudeste');
  const row = page.getByRole('region', { name: 'Localização e coleta por serviço' }).getByRole('row', { name: /Billing API/ });
  await expect(row.locator('time')).toHaveAttribute('datetime', stamp);
  failed = true;
  const before = calls;
  await page.clock.fastForward(30_001);
  await expect.poll(() => calls).toBeGreaterThan(before);
  await expect(row).toContainText('Intervalo não informado');
  await expect(row.locator('time')).toHaveAttribute('datetime', stamp);
});
