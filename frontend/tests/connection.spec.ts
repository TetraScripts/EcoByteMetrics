import { test, expect, apiService, apiMetrics, backendServices } from './fixtures';

test('a discovery HTTP error preserves the city catalogue and does not open an empty dashboard', async ({ page }) => {
  let offline = true;
  await page.route('**/backend/services', route => route.fulfill(offline ? { status: 502, json: { error: 'backend_unreachable' } } : { json: backendServices([apiService]) }));
  await page.route('**/backend/metrics/**', route => route.fulfill({ json: apiMetrics }));
  await page.goto('/pesquisa');
  await expect(page.getByRole('alert')).toContainText('HTTP 502');
  await page.getByLabel('País', { exact: true }).fill('Brasil');
  const city = page.getByLabel('Cidade', { exact: true });
  await expect(city).toBeEnabled();
  await city.selectOption('br-sudeste');
  await expect(page.getByRole('button', { name: 'Dashboard aguardando conexão', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.locator('.research-form').getByRole('status')).toContainText('Consulta indisponível');
  offline = false;
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page).toHaveURL(/regiao=br-sudeste/);
  await expect(page.locator('.metric-value').first()).not.toHaveText('—gCO₂e');
});

test('an unreachable backend preserves regions while reporting missing monitoring data', async ({ page }) => {
  await page.route('**/backend/services', route => route.abort('connectionrefused'));
  await page.goto('/pesquisa');
  await expect(page.getByRole('alert')).toContainText('não respondeu');
  await page.getByLabel('País', { exact: true }).fill('Brasil');
  await expect(page.getByLabel('Cidade', { exact: true })).toBeEnabled();
});

test('a wrong backend address returning the site HTML is diagnosed', async ({ page }) => {
  await page.route('**/backend/services', route => route.fulfill({ contentType: 'text/html', body: '<html>frontend</html>' }));
  await page.goto('/pesquisa');
  await expect(page.getByRole('alert')).toContainText('HTML em vez de dados');
  await page.getByLabel('País', { exact: true }).fill('Brasil');
  await expect(page.getByLabel('Cidade', { exact: true })).toBeEnabled();
});
