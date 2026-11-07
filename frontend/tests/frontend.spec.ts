import { expect, test } from './fixtures';

test('all screens load directly without JS errors or horizontal overflow', async ({ page }, testInfo) => {
  test.slow(); // Twelve complete page loads, including both lazy WebGL routes.
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const path of ['/', '/pesquisa', '/gerenciamento', '/dashboard', '/servicos', '/servicos/unknown-id', '/emissoes', '/energia', '/comparar', '/login', '/cadastro', '/configuracoes']) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (path === '/' || path === '/dashboard' || path === '/login') {
      await page.screenshot({ path: testInfo.outputPath(`${path === '/' ? 'home' : path.slice(1)}.png`), fullPage: true, animations: 'disabled' });
    }
  }
  expect(errors).toEqual([]);
});

test('dashboard does not invent measurements or collection timestamps', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('.metric-value').nth(0)).toHaveText('—gCO₂e');
  await expect(page.locator('.metric-value').nth(1)).toHaveText('—kWh');
  await expect(page.locator('.metric-value').nth(2)).toHaveText('0');
  await expect(page.locator('.metric-value').nth(3)).toHaveText('—');
  const period = page.getByRole('combobox', { name: 'Período de análise' });
  await expect(period.locator('option')).toHaveText(['Últimas 24 horas', 'Últimos 7 dias']);
  await period.selectOption('24h');
  await expect(page.getByRole('button', { name: 'Atualizar indicadores' })).toHaveCount(0);
  await expect(page.locator('.metric-value').first()).toHaveText('—gCO₂e');
  await expect(page.locator('.history-panel, .region-factor-panel')).toHaveCount(0);
});

test('settings are removed from navigation and direct access', async ({ page }, testInfo) => {
  await page.goto('/dashboard');
  await expect(page.locator('.header-settings')).toHaveCount(0);
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Abrir navegação' }).click();
  await expect(page.locator('a[href^="/configuracoes"]')).toHaveCount(0);
  await expect(page.locator('.dashboard-footnote p, .dashboard-footnote svg')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Pesquisar outra região', exact: true })).toBeVisible();
  await page.goto('/configuracoes');
  await expect(page.getByRole('heading', { name: 'Página não encontrada', exact: true })).toBeVisible();
});

test('login shows its pending state without storing or sending credentials', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST') requests.push(request.url()); });
  await page.goto('/login');
  await expect(page.getByLabel('E-mail', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Senha', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Mostrar senha' }).click();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'text');
  await expect(page.getByRole('button', { name: 'Login indisponível', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('');
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('test-password');
  await expect(page.getByRole('link', { name: 'Consultar sem conta', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Criar conta', exact: true }).click();
  await expect(page).toHaveURL(/\/pesquisa$/);
});

test('navigation works on desktop and mobile', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Explorar dashboard', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/dashboard');
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Abrir navegação' }).click();
    await page.getByRole('navigation', { name: 'Navegação móvel' }).getByRole('link', { name: 'Serviços', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Abrir navegação' })).toBeVisible();
  } else {
    await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Serviços', exact: true }).click();
  }
  await expect(page).toHaveURL(/\/servicos$/);
  await expect(page.getByRole('heading', { name: 'Serviços', exact: true })).toBeVisible();
  await expect(page.getByText('Em construção', { exact: true })).toBeVisible();
});

test('leaf parallax responds to the pointer and respects reduced motion', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Touch screens use static decorative leaves.');
  await page.goto('/dashboard');
  const layer = page.locator('.leaf-scene');
  await expect(layer).toBeVisible();
  await page.mouse.move(1300, 650);
  await expect.poll(async () => layer.evaluate((element) => element.style.getPropertyValue('--pointer-x'))).not.toBe('0px');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.floating-leaf').first()).toHaveCSS('animation-name', 'none');
  await expect.poll(async () => layer.evaluate((element) => Math.abs(parseFloat(element.style.getPropertyValue('--pointer-x'))))).toBeLessThan(0.1);
});

test('home changes landscapes automatically and starts at login', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('.hero__background')).toHaveCount(4);
  await expect(page.locator('.hero__background.active')).toHaveCSS('background-image', /hero-lugano/);
  await expect(page.locator('.hero-arrows, .slide-index')).toHaveCount(0);
  await expect(page.locator('.hero__background').first()).toHaveCSS('transition-duration', '1.5s');
  await page.clock.fastForward(6000);
  await expect(page.locator('.hero__background.active')).toHaveCSS('background-image', /hero-lakes/);
  for (const landscape of ['mountains', 'lagoon', 'lugano']) {
    await page.clock.fastForward(6000);
    await expect(page.locator('.hero__background.active')).toHaveCSS('background-image', new RegExp(`hero-${landscape}`));
  }
  await expect(page.getByRole('combobox', { name: 'Idioma' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Login / Cadastro' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Login / Cadastro' })).toHaveAttribute('href', '/login');
  await expect(page.getByRole('region', { name: 'Panorama de impacto' })).toBeVisible();
  await expect(page.locator('html')).toHaveCSS('font-size', '16px');
  await expect(page.locator('.site-header nav, .site-header .menu-button')).toHaveCount(0);
  await page.getByRole('link', { name: 'Explorar dashboard', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('link', { name: 'Criar conta', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveCSS('font-size', '16px');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
});

test('comparison stays empty and unknown routes provide a way home', async ({ page }) => {
  await page.goto('/comparar');
  await expect(page.getByRole('heading', { name: 'Comparar', exact: true })).toBeVisible();
  await expect(page.getByText('Em construção', { exact: true })).toBeVisible();
  await page.goto('/pagina-inexistente');
  await expect(page.getByText('404 · UM PEQUENO DESVIO')).toBeVisible();
  await page.getByRole('link', { name: 'Voltar ao início' }).click();
  await expect(page).toHaveURL(/\/$/);
});
