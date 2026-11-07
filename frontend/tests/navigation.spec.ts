import { test, expect, apiService, apiMetrics, backendServices } from './fixtures';
import { getAnalysis, analysisLink } from '../src/utils/analysis';
import { getTestSnapshot } from './data/monitoring';

async function mockServices(page: import('@playwright/test').Page, count = 1) {
  const services = Array.from({ length: count }, (_, index) => ({ ...apiService, id: 'service-' + index, name: 'Service ' + index }));
  await page.route('**/backend/services', route => route.fulfill({ json: backendServices(services) }));
  await page.route('**/backend/metrics/**', route => route.fulfill({ json: apiMetrics }));
}

test('historical dates anchor the entire period and use the location recorded at collection time', () => {
  const snapshot = getTestSnapshot('7d');
  const oldPoint = { ...snapshot.history[0]!, serviceId: 'moved-service', regionCode: 'old-region', country: 'Brasil', city: 'São Paulo' };
  snapshot.history = [oldPoint, ...snapshot.history.slice(1)];
  expect(getAnalysis(snapshot, '24h', '?ate=2026-10-08T23:59&regiao=old-region').history).toEqual([oldPoint]);
  expect(getAnalysis(snapshot, '24h', '?regiao=old-region').history).toEqual([]);
  expect(getAnalysis(snapshot, '7d', '?ate=bad').invalidDate).toBe(true);
  expect(getAnalysis(snapshot, '7d', '?ate=bad').history).toEqual([]);
  expect(analysisLink('/energia', '?pais=Brasil&periodo=24h&ate=2026-10-08T23:59&servico=demo-br')).toBe('/energia?pais=Brasil&periodo=24h&ate=2026-10-08T23%3A59');
});

test.fixme('region, period and date survive navigation; services and map open the same service detail [Sprint 2]', async ({ page }, testInfo) => {
  await mockServices(page);
  await page.goto('/dashboard?pais=Brasil&cidade=S%C3%A3o+Paulo&regiao=br-sudeste&periodo=24h');
  await expect(page.locator('.metric-value').first()).not.toHaveText('—gCO₂e');
  await page.getByLabel('Selecionar data e hora', { exact: true }).fill('2026-10-08T23:59');
  const nav = page.getByRole('navigation', { name: testInfo.project.name === 'mobile' ? 'Navegação móvel' : 'Navegação principal' });
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Abrir navegação' }).click();
  await nav.getByRole('link', { name: 'Emissões', exact: true }).click();
  const query = new URL(page.url()).searchParams;
  expect(query.get('regiao')).toBe('br-sudeste');
  expect(query.get('periodo')).toBe('24h');
  expect(query.get('ate')).toBe('2026-10-08T23:59');
  await expect(page.locator('.metric-value').first()).toHaveText('—gCO₂e');
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Abrir navegação' }).click();
  await nav.getByRole('link', { name: 'Serviços', exact: true }).click();
  await page.getByRole('link', { name: 'Service 0', exact: true }).click();
  await expect(page).toHaveURL(/\/servicos\/service-0\?/);
  await expect(page.locator('h1')).toHaveText('Service 0');
  await page.getByRole('link', { name: 'Voltar aos serviços', exact: true }).click();
  await page.getByLabel('Buscar serviço ou região', { exact: true }).fill('Service 0');
  await page.getByRole('combobox', { name: 'Filtrar por estado', exact: true }).selectOption('available');
  await page.getByRole('combobox', { name: 'Ordenar serviços', exact: true }).selectOption('energy');
  await page.getByRole('link', { name: 'Service 0', exact: true }).click();
  await page.getByRole('link', { name: 'Voltar aos serviços', exact: true }).click();
  await expect(page.getByLabel('Buscar serviço ou região', { exact: true })).toHaveValue('Service 0');
  await expect(page.getByRole('combobox', { name: 'Filtrar por estado', exact: true })).toHaveValue('available');
  await expect(page.getByRole('combobox', { name: 'Ordenar serviços', exact: true })).toHaveValue('energy');
  await page.getByRole('link', { name: 'Service 0', exact: true }).click();
  expect(new URL(page.url()).searchParams.get('ate')).toBe('2026-10-08T23:59');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Abrir navegação' }).click();
  await nav.getByRole('link', { name: 'Visão geral', exact: true }).click();
  await page.getByRole('button', { name: 'Voltar para agora', exact: true }).click();
  await page.locator('.globe-cities[aria-label="Serviços no mapa"]').getByRole('button', { name: 'Service 0', exact: true }).click();
  await expect(page).toHaveURL(/\/servicos\/service-0\?/);
});

test('indicators update automatically and removed controls stay absent', async ({ page }) => {
  await page.clock.install();
  let cpu = 50;
  let calls = 0;
  await page.route('**/backend/services', route => { calls++; return route.fulfill({ json: backendServices([apiService]) }); });
  await page.route('**/backend/metrics/**', route => route.fulfill({ json: { ...apiMetrics, metrics: { ...apiMetrics.metrics, cpu_percent: cpu } } }));
  await page.goto('/dashboard?regiao=br-sudeste');
  await expect(page.locator('.metric-value').first()).not.toHaveText('—gCO₂e');
  const initial = await page.locator('.metric-value').first().innerText();
  await expect(page.getByLabel('Usar dados de demonstração')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ver todas as regiões', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Atualizar indicadores', exact: true })).toHaveCount(0);
  cpu = 80;
  await page.clock.fastForward(30_001);
  await expect.poll(() => calls).toBe(2);
  await expect(page.locator('.metric-value').first()).not.toHaveText(initial);
});

test('leaving a pending regional search cannot navigate away from the next page', async ({ page }, testInfo) => {
  await mockServices(page);
  await page.goto('/energia');
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Abrir navegação' }).click();
  await page.getByRole('navigation', { name: testInfo.project.name === 'mobile' ? 'Navegação móvel' : 'Navegação principal' }).getByRole('link', { name: 'Pesquisa', exact: true }).click();
  await page.getByLabel('País', { exact: true }).fill('Brasil');
  await page.getByLabel('Cidade', { exact: true }).selectOption('br-sudeste');
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let pending = false;
  await page.route('**/backend/services', async route => {
    pending = true;
    await gate;
    await route.fulfill({ json: backendServices([{ ...apiService, id: 'service-0', name: 'Service 0' }]) }).catch(() => {});
  });
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect.poll(() => pending).toBe(true);
  await page.goBack();
  await expect(page).toHaveURL(/\/energia$/);
  release();
  await expect(page.locator('h1')).toHaveText('Energia');
  await expect(page.getByText('Em construção', { exact: true })).toBeVisible();
  // Re-enter monitoring: automatic collection must recover after cancellation.
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Abrir navegação' }).click();
  await page.getByRole('navigation', { name: testInfo.project.name === 'mobile' ? 'Navegação móvel' : 'Navegação principal' }).getByRole('link', { name: 'Visão geral', exact: true }).click();
  await expect(page.locator('.metric-value').first()).not.toHaveText('—gCO₂e');
});

test('account entry leads to region selection before overview and allows returning to research', async ({ page }, testInfo) => {
  await mockServices(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'Explorar dashboard', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('link', { name: 'Criar conta', exact: true }).click();
  await expect(page).toHaveURL(/\/pesquisa$/);
  await expect(page.locator('.app-header a, .app-header button, .app-header nav')).toHaveCount(0);
  await expect(page.locator('.analysis-context')).toHaveCount(0);
  await page.getByLabel('País', { exact: true }).fill('Brasil');
  await page.getByLabel('Cidade', { exact: true }).selectOption('br-sudeste');
  await expect(page).toHaveURL(/\/pesquisa\?/);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\?.*regiao=br-sudeste/);
  await expect(page.locator('.analysis-context')).toContainText('São Paulo');
  await expect(page.locator('.metric-value').first()).not.toHaveText('—gCO₂e');
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Abrir navegação' }).click();
  await page.getByRole('navigation', { name: testInfo.project.name === 'mobile' ? 'Navegação móvel' : 'Navegação principal' }).getByRole('link', { name: 'Pesquisa', exact: true }).click();
  await expect(page).toHaveURL(/\/pesquisa\?.*regiao=br-sudeste/);
  await expect(page.getByLabel('Cidade', { exact: true })).toHaveValue('br-sudeste');
  await expect(page.locator('.app-header a, .app-header button, .app-header nav')).toHaveCount(0);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\?.*regiao=br-sudeste/);
});

test.fixme('administration records actual requests and can clear the local diagnostic list [Sprint 2]', async ({ page }) => {
  await mockServices(page);
  await page.goto('/gerenciamento');
  await page.getByRole('button', { name: 'Requisições da API', exact: true }).click();
  await expect(page.getByText('Nenhuma requisição registrada')).toBeVisible();
  await page.getByRole('button', { name: 'Consultar agora', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Consultar agora', exact: true })).toBeEnabled();
  await expect(page.locator('.admin-content table tbody tr')).toHaveCount(3);
  await expect(page.locator('.admin-content table')).toContainText('HTTP 200');
  await page.getByRole('button', { name: 'Limpar registros locais', exact: true }).click();
  await expect(page.getByText('Nenhuma requisição registrada')).toBeVisible();
});

test.fixme('service details show observed data without a region simulator [Sprint 2]', async ({ page }) => {
  await mockServices(page);
  await page.goto('/servicos/service-0');
  await expect(page.locator('h1')).toHaveText('Service 0');
  await expect(page.getByText('Recursos da última consulta', { exact: true })).toBeVisible();
  await expect(page.getByText('Simular outra região', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Região de destino', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('an initial 404 has a useful fallback', async ({ page }) => {
  await page.goto('/invalid-start');
  await page.getByRole('button', { name: 'Voltar à página anterior', exact: true }).click();
  await expect(page).toHaveURL(/\/pesquisa$/);
});
