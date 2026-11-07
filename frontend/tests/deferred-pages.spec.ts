import { expect, test } from "./fixtures";

const pages = [
  ["/energia", "Energia"],
  ["/comparar", "Comparar"],
  ["/gerenciamento", "Gerenciamento"],
  ["/emissoes", "Emissões"],
  ["/servicos", "Serviços"],
] as const;

test("Sprint 2 pages stay accessible without content or monitoring requests", async ({ page }) => {
  await page.clock.install();
  let calls = 0;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/backend/**", route => { calls++; return route.abort(); });
  await page.route("https://carbon.unilaunch.org/**", route => { calls++; return route.abort(); });
  for (const [path, title] of [...pages, ["/servicos/billing-api", "Serviços"]]) {
    await page.goto(path + "?periodo=24h&regiao=br-sudeste");
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.getByRole("main")).toHaveText(new RegExp("^\\s*" + title + "\\s*Em construção\\s*$"));
    await expect(page.locator("main input, main select, main table, .metric-card, .leaf-scene")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.clock.fastForward(30_001);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(calls).toBe(0);
  expect(errors).toEqual([]);
});

test("navigation reaches deferred pages and returns to the working dashboard", async ({ page }, info) => {
  await page.goto("/dashboard?periodo=24h&regiao=br-sudeste");
  await expect(page.locator(".metric-card")).toHaveCount(4);
  for (const [path, label] of [...pages, ["/dashboard", "Visão geral"]]) {
    if (info.project.name === "mobile") await page.getByRole("button", { name: "Abrir navegação" }).click();
    const navigation = page.getByRole("navigation", { name: info.project.name === "mobile" ? "Navegação móvel" : "Navegação principal" });
    await navigation.getByRole("link", { name: label, exact: true }).click();
    await expect(page.locator("h1")).toBeVisible();
    const url = new URL(page.url());
    expect(url.pathname).toBe(path);
    expect(url.searchParams.get("periodo")).toBe("24h");
    expect(url.searchParams.get("regiao")).toBe("br-sudeste");
  }
  await expect(page.locator(".construction-page")).toHaveCount(0);
  await expect(page.locator(".metric-card")).toHaveCount(4);
});
