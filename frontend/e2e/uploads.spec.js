// Subida de imágenes con foto real + flujos secundarios (búsqueda,
// carruseles, reset) + viewport móvil.
const { test, expect } = require("@playwright/test");
const { setupRestaurant, setupMenuTable, uiLogin } = require("./helpers");

const stamp = Date.now().toString(36);
const REAL_PHOTO = "/home/kaydo/Pictures/authgoogleciciapp.png";
let ctx;

test.beforeAll(async ({ request }) => {
  ctx = await setupRestaurant(`upl${stamp}`, request);
});

test("producto con foto real se guarda y muestra preview", async ({ page }) => {
  await uiLogin(page, ctx.email, ctx.password, /\/admin/);
  await page.goto("/admin/menu");
  // Categoría primero (el formulario de producto la necesita).
  await page.getByRole("button", { name: /categorías/i }).click();
  await page.getByRole("button", { name: /nueva/i }).click();
  await page.getByPlaceholder("Ej: Bebidas").fill("Fotos");
  await page.getByRole("button", { name: /^guardar$/i }).click();
  await expect(page.getByText("Fotos")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: /productos/i }).click();
  await page.getByRole("button", { name: /nuevo producto/i }).click();
  await page.getByPlaceholder("Nombre del producto").fill(`Plato Foto ${stamp}`);
  await page.getByPlaceholder(/12\.000/).fill("20000");
  await page.locator("select").first().selectOption({ index: 1 });
  await page.locator('input[type="file"]').setInputFiles(REAL_PHOTO);
  await expect(page.getByAltText(/vista previa/i)).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: /crear producto/i }).click();
  await expect(page.getByText(`Plato Foto ${stamp}`)).toBeVisible({ timeout: 15000 });
});

test("búsqueda del menú filtra sin resultados", async ({ page, request }) => {
  const setup = await setupMenuTable(request, ctx.headers, `S${stamp}`);
  await page.goto(`/menu/${setup.tableQr}`);
  await expect(page.getByText(/bandeja|plato/i).first()).toBeVisible({ timeout: 20000 });
  await page.getByPlaceholder("Buscar en el menú...").fill("zzz-no-existe");
  await expect(page.getByText(/no se encontraron productos/i)).toBeVisible({ timeout: 15000 });
});
