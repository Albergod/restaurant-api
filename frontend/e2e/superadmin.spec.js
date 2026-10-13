// Superadmin UI: crear, desactivar y reactivar restaurantes.
// Requiere E2E_ALLOW_REGISTRATION=true (solo entorno e2e) para dar de alta
// al superadmin vía API pública; en producción se crea por variables de entorno.
const { test, expect } = require("@playwright/test");
const { uiLogin } = require("./helpers");

const API = process.env.E2E_API_URL || "http://localhost:8001";
const stamp = Date.now().toString(36);
const SUID = `sa-${stamp}`;
const SPASS = "superpass123";
const SLUG = `rest-${stamp}`;

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${API}/api/auth/register`, {
    data: { name: "SA", email: `${SUID}@e2e.co`, password: SPASS, role: "superadmin" },
  });
  if (res.status() !== 201) throw new Error("setup superadmin: " + (await res.text()));
});

test("superadmin crea restaurante desde la UI y ve sus credenciales", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("tu@email.com").fill(`${SUID}@e2e.co`);
  await page.getByPlaceholder(/••••/).fill(SPASS);
  await page.getByRole("button", { name: /entrar al sistema/i }).click();
  await expect(page).toHaveURL(/\/superadmin\/restaurants/, { timeout: 20000 });

  await page.getByRole("button", { name: /nuevo restaurante/i }).click();
  await expect(page).toHaveURL(/\/superadmin\/restaurants\/new/);
  await page.getByPlaceholder("Pizzería Don Pepe").fill(`Rest E2E ${stamp}`);
  await page.getByPlaceholder("pizzeria-don-pepe").fill(SLUG);
  await page.getByPlaceholder("Juan Pérez").fill("Owner E2E");
  await page.getByPlaceholder("juan@pizzeria.com").fill(`owner-${stamp}@e2e.co`);
  // password: campo de texto (se generaría solo si se deja vacío)
  await page.getByPlaceholder(/se generará automáticamente/i).fill("ownerpass123");
  await page.getByRole("button", { name: /crear restaurante/i }).click();

  // Pantalla de credenciales generadas/mostradas.
  await expect(page.getByText(SLUG)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(`owner-${stamp}@e2e.co`)).toBeVisible();
});

test("superadmin desactiva y reactiva desde la UI", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("tu@email.com").fill(`${SUID}@e2e.co`);
  await page.getByPlaceholder(/••••/).fill(SPASS);
  await page.getByRole("button", { name: /entrar al sistema/i }).click();
  await expect(page).toHaveURL(/\/superadmin\/restaurants/, { timeout: 20000 });

  const card = page.locator("div", { hasText: SLUG }).last();
  await card.getByRole("button", { name: /desactivar/i }).click();
  // El diálogo pide escribir el slug para confirmar.
  await page.getByPlaceholder(SLUG).fill(SLUG);
  await page.getByRole("button", { name: /^desactivar$/i }).click();
  await expect(page.getByText(/inactivos/i).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(SLUG)).toBeVisible();

  // Reactivar
  const card2 = page.locator("div", { hasText: SLUG }).last();
  await card2.getByRole("button", { name: /reactivar/i }).click();
  await expect(page.getByText(/activo/i).first()).toBeVisible({ timeout: 15000 });
});
