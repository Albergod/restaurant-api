// Reset de restaurante (superadmin UI) + viewport móvil.
// Requiere E2E_ALLOW_REGISTRATION=true (igual que superadmin.spec.js).
const { test, expect } = require("@playwright/test");
const { uiLogin } = require("./helpers");

const API = process.env.E2E_API_URL || "http://localhost:8001";
const stamp = Date.now().toString(36);
const SUID = `sar-${stamp}`;
const SPASS = "superpass123";
const SLUG = `reset-${stamp}`;

test.beforeAll(async ({ request }) => {
  const res = await request.post(`${API}/api/auth/register`, {
    data: { name: "SA", email: `${SUID}@e2e.co`, password: SPASS, role: "superadmin" },
  });
  if (res.status() !== 201) throw new Error("setup superadmin reset: " + (await res.text()));
  const created = await request.post(`${API}/api/restaurants/`, {
    headers: await superHeaders(request),
    data: { name: `Reset E2E ${stamp}`, slug: SLUG, admin_password: "adminpass123" },
  });
  if (created.status() !== 201) throw new Error("setup restaurante reset: " + (await created.text()));

  async function superHeaders(req) {
    const login = await req.post(`${API}/api/auth/login`, {
      form: { username: `${SUID}@e2e.co`, password: SPASS },
    });
    return { Authorization: `Bearer ${(await login.json()).access_token}` };
  }
});

test("superadmin resetea contenido desde la UI", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("tu@email.com").fill(`${SUID}@e2e.co`);
  await page.getByPlaceholder(/••••/).fill(SPASS);
  await page.getByRole("button", { name: /entrar al sistema/i }).click();
  await expect(page).toHaveURL(/\/superadmin\/restaurants/, { timeout: 20000 });

  const card = page.locator("article", {
    has: page.locator("code", { hasText: SLUG }),
  });
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.getByRole("button", { name: /^reset$/i }).click();
  await page.getByPlaceholder(SLUG).fill(SLUG);

  const dialogPromise = page.waitForEvent("dialog", { timeout: 15000 });
  await page.getByRole("button", { name: /^resetear$/i }).click();
  const dialog = await dialogPromise;
  expect(dialog.message()).toMatch(/reset completado/i);
  await dialog.dismiss();
  await expect(page.getByText(/resetear contenido/i)).toHaveCount(0);
});

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

test("viewport móvil: landing y registro usables", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /probar gratis 14 días/i }).first()).toBeVisible();
  await page.getByRole("button", { name: /probar gratis 14 días/i }).first().click();
  await expect(page).toHaveURL(/\/register/);
  await page.getByPlaceholder("Nombre del restaurante").fill(`Móvil ${stamp}`);
  await page.getByPlaceholder("mi-restaurante").fill(`movil-${stamp}`);
  await page.getByPlaceholder("Tu nombre").fill("Móvil");
  await page.getByPlaceholder("Correo electrónico").fill(`movil-${stamp}@e2e.co`);
  await page.getByPlaceholder(/Contraseña/).fill("movilpass123");
  await page.getByRole("button", { name: /crear mi restaurante/i }).click();
  await expect(page).toHaveURL(/\/admin/, { timeout: 20000 });
});
