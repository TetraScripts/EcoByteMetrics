import { test, expect, apiMetrics, apiRegions, backendServices } from './fixtures';
import { getRegionIssues } from '../src/utils/region';
import { getTestSnapshot } from './data/monitoring';

const japan = { id: 'audit-stream', name: 'Audit Stream', location: { ...apiRegions[4], region_code: 'jp-east' } };

test('alert reasons identify missing fields and ignore healthy or removed services', () => {
  const services = getTestSnapshot('7d').services;
  expect(getRegionIssues([services[0]])).toEqual([]);
  expect(getRegionIssues([{ ...services[2], status: 'removed' }])).toEqual([]);
  expect(getRegionIssues([services[2]])).toEqual(['Aplicação Japão: Métricas ausentes ou inválidas: memória RAM, disco, rede.']);
  expect(getRegionIssues([{ ...services[0], emissionsG: null, statusMessage: 'Fator de carbono não disponível para br-sudeste.' }])).toEqual(['Aplicação Brasil: Fator de carbono não disponível para br-sudeste.']);
});

test('unavailable services show a real alert and recover after retry', async ({ page }) => {
  let unavailable = true;
  await page.route('**/backend/services', route => route.fulfill({ json: backendServices([japan]) }));
  await page.route('**/backend/metrics/**', route => route.fulfill(unavailable ? { status: 500, json: { error: 'service_unavailable' } } : { json: apiMetrics }));
  await page.goto('/pesquisa');
  await page.getByLabel('País', { exact: true }).fill('Japão');
  await page.getByLabel('Cidade', { exact: true }).selectOption('jp-east');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Serviço indisponível');
  unavailable = false;
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page).toHaveURL(/regiao=jp-east/);
});

test('real partial metrics show the failing field and can be retried', async ({ page }, testInfo) => {
  let missing = true;
  await page.route(/\/backend\/(?:services$|metrics\/)/, (route) => route.fulfill({ json: route.request().url().endsWith('/services') ? backendServices([japan]) : { ...apiMetrics, metrics: { ...apiMetrics.metrics, memory_gb: missing ? null : 2 } } }));
  await page.goto('/pesquisa');
  await page.getByLabel('País', { exact: true }).fill('Japão');
  await page.getByLabel('Cidade', { exact: true }).selectOption('jp-east');
  await expect(page.getByRole('button', { name: 'Buscar', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Dados das APIs do desafio');
  await expect(dialog).toContainText('Audit Stream: Métricas ausentes ou inválidas: memória RAM.');
  await expect(dialog).not.toContainText('SIMULAÇÃO');
  await expect(page.getByRole('button', { name: 'Consultar APIs reais', exact: true })).toHaveCount(0);
  await dialog.screenshot({ path: testInfo.outputPath('real-alert.png') });
  missing = false;
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page).toHaveURL(/regiao=jp-east/);
  await expect(page.locator('.metric-value').first()).not.toHaveText('—gCO₂e');
});
