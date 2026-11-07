import { expect, test } from "./fixtures";

test("homepage explains the model without presenting monitoring measurements", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(page.getByRole("region", { name: "Panorama de impacto" })).toBeVisible();
  await expect(main).not.toContainText(/\d+(?:[.,]\d+)?\s*(?:kWh|gCO₂e|W\b|%)/);
  await expect(main.locator(".metric-value, .impact-card__value")).toHaveCount(0);
  await page.getByRole("heading", { name: "Potência × tempo", exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: "Potência × tempo", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Energia × intensidade de carbono", exact: true })).toBeVisible();
});

test("homepage keeps only the brand and login in its header", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  await expect(header.getByRole("navigation")).toHaveCount(0);
  await expect(header.getByRole("button")).toHaveCount(0);
  await expect(header.getByRole("link", { name: "Login / Cadastro", exact: true })).toBeVisible();
  await expect(page.locator(".project-status, .secondary-cta")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Pesquisar uma região", exact: true })).toHaveCount(0);
  await header.getByRole("link", { name: "Login / Cadastro", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});
