import { expect, test, mockRegionalScenario } from './fixtures';
import { getTestSnapshot } from './data/monitoring';
import { getRegionAlert, matchesRegion } from '../src/utils/region';

test('regional matching and alerts respect accents, removed services and partial metrics', () => {
  const snapshot = getTestSnapshot('7d');
  const brazil = snapshot.services[0];
  expect(matchesRegion(brazil, ' brasil ', 'sao paulo')).toBe(true);
  expect(matchesRegion(brazil, 'Brasil', 'Santos')).toBe(false);
  expect(getRegionAlert([brazil])).toBeNull();
  expect(getRegionAlert([])).toBe('unknown');
  expect(getRegionAlert([{ ...brazil, status: 'removed' }])).toBe('unknown');
  expect(getRegionAlert([snapshot.services[1]])).toBe('unavailable');
  expect(getRegionAlert([snapshot.services[2]])).toBe('incomplete');
  expect(getRegionAlert([{ ...brazil, cpuPercent: null }])).toBe('incomplete');
  expect(getRegionAlert([{ ...brazil, cpuPercent: 0 }])).toBeNull();
  expect(getTestSnapshot('24h').history).toHaveLength(1);
  expect(snapshot.totalEnergyKwh).toBeCloseTo(snapshot.history.reduce((sum, point) => sum + point.energyKwh, 0), 10);
});

test('research distinguishes disconnected monitoring from unknown regions', async ({ page }) => {
  await page.route('**/backend/services', route => route.fulfill({ status: 503, json: { error: 'unavailable' } }));
  await page.goto('/pesquisa');
  await page.getByLabel('País', { exact: true }).fill('Brasil');
  await expect(page.getByRole('alert')).toContainText('Não foi possível consultar o agregador');
  await page.getByLabel('Cidade', { exact: true }).selectOption('br-sudeste');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.locator('.research-form').getByRole('status')).toContainText('Consulta indisponível');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('public login entry starts research and unknown pages offer recovery', async ({ page }, testInfo) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Criar conta', exact: true }).click();
  await expect(page).toHaveURL(/\/pesquisa$/);
  await expect(page.getByLabel('Usar dados de demonstração')).toHaveCount(0);
  await page.goto('/endereco-inexistente');
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('not-found.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Voltar à página anterior', exact: true }).click();
  await expect(page).toHaveURL(/\/pesquisa$/);
  await page.goto('/endereco-inexistente');
  await page.screenshot({ path: testInfo.outputPath('not-found.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('link', { name: 'Voltar ao início', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('research opens each alert and carries the selected region into the dashboard', async ({ page }, testInfo) => {
  test.slow();
  await mockRegionalScenario(page);
  await page.goto('/pesquisa');

  await page.getByLabel('País', { exact: true }).fill('Portugal');
  await expect(page.getByLabel('Cidade', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Região desconhecida');
  await expect(page.getByRole('button', { name: 'Nova busca', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByLabel('País', { exact: true }).fill('França');
  await page.getByLabel('Cidade', { exact: true }).selectOption({ label: 'Paris' });
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Serviço indisponível');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByLabel('País', { exact: true }).fill('Japão');
  await page.getByLabel('Cidade', { exact: true }).selectOption({ label: 'Tóquio' });
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Métricas incompletas');
  await page.screenshot({ path: testInfo.outputPath('metrics-alert.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Ver dashboard', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\?.*pais=/);
  await expect(page.locator('.page-heading')).toContainText('Japão — Tóquio');
  await expect(page.locator('.metric-value').first()).toHaveText('—gCO₂e');
  await page.getByRole('link', { name: 'Pesquisar outra região' }).click();
  await page.getByLabel('País', { exact: true }).fill('brasil');
  await page.getByLabel('Cidade', { exact: true }).selectOption({ label: 'São Paulo' });
  await page.screenshot({ path: testInfo.outputPath('research.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\?/);
  await expect(page.locator('.metric-value').first()).not.toHaveText('—gCO₂e');
  await expect(page.locator('.collection-ranking li').first()).toBeVisible();
  await page.getByLabel('Selecionar data e hora', { exact: true }).fill('2026-10-09T23:59');
  await expect(page.locator('.collection-ranking li')).toHaveCount(0);
  await page.getByRole('button', { name: 'Voltar para agora', exact: true }).click();
  await expect(page.locator('.collection-ranking li').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('regional-dashboard.png'), fullPage: true, animations: 'disabled' });

});

test.fixme('administration exposes pending integration without fictional users [Sprint 2]', async ({ page }) => {
  await page.goto('/gerenciamento');
  await expect(page.getByText('Controle de usuários em breve')).toBeVisible();
  await expect(page.getByRole('button', { name: /Editar Usuário|Bloquear Usuário/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sistema', exact: true }).click();
  await expect(page.getByText('Não disponível', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Requisições da API', exact: true }).click();
  await expect(page.getByText('Nenhuma requisição registrada')).toBeVisible();
});
