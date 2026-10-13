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
  await page.getByPlaceholder(/12\.000/).fill("18000");
  await page.locator("select").first().selectOption({ index: 1 });
  await page.getByRole("button", { name: /crear producto/i }).click();
  await expect(page.getByText(`Plato UI ${stamp}`)).toBeVisible({ timeout: 15000 });
});

test("admin mueve producto a una categoría recién creada (auditoría)", async ({ page }) => {
  const newCat = `Bebidas UI ${stamp}`;
  await uiLogin(page, ctx.email, ctx.password, /\/admin/);
  await page.goto("/admin/menu");

  // Crea la categoría nueva como la auditora.
  await page.getByRole("button", { name: /categorías/i }).click();
  await page.getByRole("button", { name: /nueva/i }).click();
  await page.getByPlaceholder("Ej: Bebidas").fill(newCat);
  await page.getByRole("button", { name: /^guardar$/i }).click();
  await expect(page.getByText(newCat)).toBeVisible({ timeout: 15000 });

  // Edita el producto del test anterior y lo cambia a la categoría nueva.
  await page.getByRole("button", { name: /productos/i }).click();
  const card = page.locator("div.rounded-xl", { hasText: `Plato UI ${stamp}` }).first();
  await card.getByRole("button", { name: /editar producto/i }).click();
  await page.locator("select").first().selectOption({ label: newCat });
  await page.getByRole("button", { name: /guardar cambios/i }).click();

  // Filtra por la categoría nueva: el producto debe estar ahí…
  await page.getByRole("button", { name: newCat }).click();
  await expect(page.getByText(`Plato UI ${stamp}`)).toBeVisible({ timeout: 15000 });
  // …y ya no en la anterior.
  await page.getByRole("button", { name: /todas/i }).click();
  await page.getByRole("button", { name: `Cat UI ${stamp}` }).click();
  await expect(page.getByText(`Plato UI ${stamp}`)).toHaveCount(0);
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

test("precio COP: se escribe 25000, se ve 25.000 y nunca .00", async ({ page }) => {  await uiLogin(page, ctx.email, ctx.password, /\/admin/);
  await page.goto("/admin/menu");
  await page.getByRole("button", { name: /productos/i }).click();
  await page.getByRole("button", { name: /nuevo producto/i }).click();
  const name = `Precio UI ${stamp}`;
  await page.getByPlaceholder("Nombre del producto").fill(name);
  // El input es texto con inputMode numérico: se teclea plano y se formatea.
  const priceInput = page.getByPlaceholder(/12\.000/);
  await priceInput.fill("25000");
  await expect(priceInput).toHaveValue("25.000");
  await page.locator("select").first().selectOption({ index: 1 });
  await page.getByRole("button", { name: /crear producto/i }).click();
  const card = page.locator("div.rounded-xl", { hasText: name }).first();
  await expect(card).toBeVisible({ timeout: 15000 });
  const priceText = await card.textContent();
  expect(priceText.replace(/\s/g, " ")).toContain("$ 25.000");
  expect(priceText).not.toMatch(/\$\s?[\d.]*\.\d{2}\b/);
});

test("cuenta real no muestra guías demo", async ({ page }) => {
  await uiLogin(page, ctx.email, ctx.password, /\/admin/);
  await expect(page).toHaveURL(/\/admin/, { timeout: 20000 });
  await expect(page.getByText(/paso 1 de 4/i)).toHaveCount(0);
  await page.goto("/admin/menu");
  await expect(page.getByText(/mueve un plato de una a otra/i)).toHaveCount(0);
  await expect(page.getByText("TOUR DEMO")).toHaveCount(0);
});

test("categorías: renombrar y borrado bloqueado con aviso si tiene platos", async ({ page }) => {
  const renamed = `Cat Renombrada ${stamp}`;
  await uiLogin(page, ctx.email, ctx.password, /\/admin/);
  await page.goto("/admin/menu");
  await page.getByRole("button", { name: /categorías/i }).click();

  // Renombrar la categoría con el plato dentro (Bebidas UI lo recibió antes).
  await page.getByRole("button", { name: `Renombrar Bebidas UI ${stamp}` }).click();
  await expect(page.getByText(/renombrar categoría/i)).toBeVisible({ timeout: 10000 });
  await page.getByPlaceholder("Ej: Bebidas").fill(renamed);
  await page.getByRole("button", { name: /guardar cambios/i }).click();
  await expect(page.getByText(renamed)).toBeVisible({ timeout: 15000 });

  // Intentar borrarla: bloqueado con aviso (tiene 1 producto).
  await page.getByRole("button", { name: `Eliminar ${renamed}` }).click();
  await page.getByRole("button", { name: /^eliminar$/i }).click();
  await expect(page.getByText(/no se puede eliminar/i)).toBeVisible({ timeout: 15000 });
  // La categoría sigue ahí.
  await expect(page.getByText(renamed)).toBeVisible({ timeout: 10000 });
});
