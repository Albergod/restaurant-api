// Auth por roles + CRUD admin (menú, mesas, usuarios) + logout.
const { test, expect } = require("@playwright/test");
const { setupRestaurant, setupMenuTable, uiLogin } = require("./helpers");

const stamp = Date.now().toString(36);
let ctx;

test.beforeAll(async ({ request }) => {
  ctx = await setupRestaurant(`admin${stamp}`, request);
});

test("login admin entra al dashboard y sale (logout)", async ({ page }) => {
  await uiLogin(page, ctx.email, ctx.password, /\/admin/);
  await expect(page.getByText(/resumen general del restaurante/i)).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /cerrar sesión|salir/i }).first().click();
  await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
});

test("login con clave mala muestra error y no entra", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("tu@email.com").fill(ctx.email);
  await page.getByPlaceholder(/••••/).fill("clave-equivocada");
  await page.getByRole("button", { name: /entrar al sistema/i }).click();
  await expect(page.getByText(/incorrectos/i)).toBeVisible({ timeout: 10000 });
  expect(page.url()).toContain("/login");
});

test("admin crea categoría y producto desde la UI", async ({ page }) => {
  await uiLogin(page, ctx.email, ctx.password, /\/admin/);
  await page.goto("/admin/menu");
  await page.getByRole("button", { name: /categorías/i }).click();
  await page.getByRole("button", { name: /nueva/i }).click();
  await page.getByPlaceholder("Ej: Bebidas").fill(`Cat UI ${stamp}`);
  await page.getByRole("button", { name: /^guardar$/i }).click();
  await expect(page.getByText(`Cat UI ${stamp}`)).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: /productos/i }).click();
  await page.getByRole("button", { name: /nuevo producto/i }).click();
  await page.getByPlaceholder("Nombre del producto").fill(`Plato UI ${stamp}`);
  await page.getByPlaceholder("0.00").fill("18000");
  await page.locator("select").first().selectOption({ index: 1 });
  await page.getByRole("button", { name: /crear producto/i }).click();
  await expect(page.getByText(`Plato UI ${stamp}`)).toBeVisible({ timeout: 15000 });
});

test("admin crea mesa con QR desde la UI", async ({ page }) => {
  await uiLogin(page, ctx.email, ctx.password, /\/admin/);
  await page.goto("/admin/tables");
  await page.getByRole("button", { name: /nueva mesa/i }).click();
  await page.getByPlaceholder("Ej: 1, 2, 3...").fill("9");
  await page.getByRole("button", { name: /crear mesa/i }).click();
  await expect(page.getByText(/mesa #9/i).first()).toBeVisible({ timeout: 15000 });
});

test("admin crea mesero y el mesero entra a su panel", async ({ page, request }) => {
  await uiLogin(page, ctx.email, ctx.password, /\/admin/);
  await page.goto("/admin/users");
  await page.getByRole("button", { name: /nuevo usuario/i }).click();
  const wemail = `mesero-${stamp}@e2e.co`;
  await page.getByPlaceholder("Nombre completo").fill("Mesero UI");
  await page.getByPlaceholder("usuario@email.com").fill(wemail);
  await page.getByPlaceholder(/^contraseña$/i).fill("meseropass123");
  // El rol por defecto del diálogo es mesero.
  await page.getByRole("button", { name: /crear usuario/i }).click();
  await expect(page.getByText(wemail)).toBeVisible({ timeout: 15000 });

  // El mesero entra a su panel (sesión limpia: el login redirige si hay token).
  await page.evaluate(() => localStorage.clear());
  await page.goto("/login");
  await page.getByPlaceholder("tu@email.com").fill(wemail);
  await page.getByPlaceholder(/••••/).fill("meseropass123");
  await page.getByRole("button", { name: /entrar al sistema/i }).click();
  await expect(page).toHaveURL(/\/waiter/, { timeout: 20000 });
});
