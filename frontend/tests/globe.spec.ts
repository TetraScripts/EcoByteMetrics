import { expect, test, mockRegionalScenario } from './fixtures';
import { countries, findCountry, getCities } from '../src/data/geography';
import { getTestSnapshot } from './data/monitoring';

test('geographic catalogue matches names and uses registered regions only', () => {
  expect(countries).toHaveLength(177);
  expect(new Set(countries.map((country) => country.properties.code)).size).toBe(countries.length);
  expect(findCountry(' brazil ')?.properties.code).toBe('BR');
  expect(findCountry('franca')?.properties.code).toBe('FR');
  expect(findCountry('United States')?.properties.code).toBe('US');
  expect(findCountry('Irlanda')?.properties.code).toBe('IE');
  expect(findCountry('País inexistente')).toBeUndefined();
  const demo = getTestSnapshot('7d');
  const cities = getCities('BR', demo.regions);
  expect(cities.map(city => city.name)).toEqual(['São Paulo']);
  expect(cities[0].latitude).toBe(demo.regions[0].latitude);
  expect(getCities('US', demo.regions)).toEqual([]);
  expect(cities.every((city) => city.countryCode === 'BR')).toBe(true);
});

test('globe country and city selection drives the CO2 query and resets in order', async ({ page }, testInfo) => {
  test.slow();
  if (testInfo.project.name === 'mobile') await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockRegionalScenario(page);
  await page.goto('/pesquisa');
  await expect(page.getByLabel('Cidade', { exact: true })).toBeDisabled();
  await page.locator('.region-map').scrollIntoViewIfNeeded();
  await page.locator('.globe-stage[data-ready="true"]').waitFor();
  const canvas = page.locator('.globe-stage canvas');
  await canvas.scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  const countryPoint = { x: bounds!.width / 2 - bounds!.height * 0.1, y: bounds!.height * 0.63 };
  if (testInfo.project.name === 'mobile') await canvas.tap({ position: countryPoint });
  else {
    await expect.poll(async () => {
      await page.mouse.move(bounds!.x + countryPoint.x + 1, bounds!.y + countryPoint.y);
      await page.mouse.move(bounds!.x + countryPoint.x, bounds!.y + countryPoint.y);
      return page.locator('.globe-hover').textContent().catch(() => '');
    }).toBe('Brasil');
    await canvas.click({ position: countryPoint });
  }
  await expect(page.getByLabel('País', { exact: true })).toHaveValue('Brasil');
  await expect(page.getByLabel('Cidade', { exact: true })).toBeEnabled();
  await expect(page.locator('.region-map')).toHaveAttribute('data-country', 'BR');
  if (testInfo.project.name === 'desktop') {
    const cityPoint = { x: bounds!.x + bounds!.width / 2 + bounds!.height * 0.12, y: bounds!.y + bounds!.height * 0.667 };
    await expect.poll(async () => {
      await page.mouse.move(cityPoint.x + 1, cityPoint.y);
      await page.mouse.move(cityPoint.x, cityPoint.y);
      return page.locator('.globe-hover').textContent().catch(() => '');
    }).toBe('São Paulo');
    await canvas.click({ position: { x: cityPoint.x - bounds!.x, y: cityPoint.y - bounds!.y } });
  } else {
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await canvas.tap({ position: { x: bounds!.width / 2 + bounds!.height * 0.12, y: bounds!.height * 0.667 } });
  }
  await expect(page.getByLabel('Cidade', { exact: true }).locator('option:checked')).toHaveText('São Paulo');
  await expect(page.locator('.globe-cities button.active')).toHaveText('São Paulo');
  await page.getByRole('button', { name: 'Aproximar globo' }).click();
  await page.getByRole('button', { name: 'Afastar globo' }).click();
  await page.screenshot({ path: testInfo.outputPath('interactive-globe.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\?.*cidade=S%C3%A3o\+Paulo/);
  await expect(page.locator('.metric-value').first()).not.toHaveText('—gCO₂e');
  await page.getByRole('link', { name: 'Pesquisar outra região' }).click();
  await page.getByLabel('País', { exact: true }).fill('Japão');
  await page.getByRole('button', { name: 'Tóquio', exact: true }).click();
  await page.getByLabel('País', { exact: true }).fill('França');
  await expect(page.getByLabel('Cidade', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Tóquio', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Paris', exact: true }).click();
  await page.getByRole('button', { name: 'Voltar ao mundo', exact: true }).click();
  await expect(page.getByLabel('País', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Cidade', { exact: true })).toBeDisabled();
});

test('dashboard globe preserves its region and changing it requires returning to research', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockRegionalScenario(page);
  await page.goto('/dashboard?regiao=demo-br&periodo=24h');
  await expect(page.locator('.metric-value').first()).not.toHaveText('—gCO₂e');
  const selectedUrl = page.url();
  const map = page.locator('.region-map');
  await map.scrollIntoViewIfNeeded();
  await expect(map).toHaveAttribute('data-read-only', 'true');
  await expect(map).toHaveAttribute('data-country', 'BR');
  await expect(map.getByRole('button', { name: 'Voltar ao mundo', exact: true })).toHaveCount(0);
  await expect(map.locator('.globe-cities')).toHaveCount(0);
  await map.locator('.globe-stage[data-ready="true"]').waitFor();
  await page.getByRole('button', { name: 'Girar globo à esquerda', exact: true }).click();
  const canvas = map.locator('canvas');
  const bounds = (await canvas.boundingBox())!;
  // Find a visible country other than Brazil, so the click would change the
  // selection if either the mouse handler or the touch raycast were enabled.
  let countryPoint: { x: number; y: number } | undefined;
  for (const y of [-0.15, 0, 0.15, -0.3, 0.3]) {
    for (const x of [0, -0.15, 0.15, -0.3, 0.3]) {
      const point = { x: bounds.width / 2 + x * bounds.height, y: bounds.height * (0.5 + y) };
      await page.mouse.move(bounds.x + point.x, bounds.y + point.y);
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const hovered = (await page.locator('.globe-hover').allTextContents())[0];
      const country = hovered ? findCountry(hovered) : undefined;
      if (country && country.properties.code !== 'BR') { countryPoint = point; break; }
    }
    if (countryPoint) break;
  }
  expect(countryPoint).toBeDefined();
  if (testInfo.project.name === 'mobile') await canvas.tap({ position: countryPoint! });
  else await canvas.click({ position: countryPoint! });
  await page.getByRole('button', { name: 'Aproximar globo', exact: true }).click();
  await page.getByRole('button', { name: 'Afastar globo', exact: true }).click();
  await expect(page).toHaveURL(selectedUrl);
  await expect(map).toHaveAttribute('data-country', 'BR');
  await expect(map.locator('.globe-selection')).toContainText('Brasil — São Paulo');
  await page.getByRole('link', { name: 'Pesquisar outra região', exact: true }).click();
  await expect(page).toHaveURL(/\/pesquisa\?.*regiao=demo-br/);
  await expect(page.getByLabel('Cidade', { exact: true })).toHaveValue('demo-br');
  await expect(page.locator('.region-map')).toHaveAttribute('data-read-only', 'false');
  await page.getByLabel('País', { exact: true }).fill('Japão');
  await page.getByLabel('Cidade', { exact: true }).selectOption('demo-jp');
  await expect(page).toHaveURL(/\/pesquisa\?.*regiao=demo-jp/);
});

test('country and city fields remain usable when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await mockRegionalScenario(page);
  await page.goto('/pesquisa');
  await page.locator('.region-map').scrollIntoViewIfNeeded();
  await expect(page.getByText('A visualização 3D não está disponível neste navegador. Continue pelos campos de país e cidade.')).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('País', { exact: true }).fill('Brasil');
  await page.getByRole('button', { name: 'São Paulo', exact: true }).click();
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\?/);
  await expect(page.locator('.metric-value').first()).not.toHaveText('—gCO₂e');
});
