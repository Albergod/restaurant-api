// Paywall y estados de suscripción en la UI (con /billing/status mockeado;
// el backend real ya cubre los 402 en pytest).
const { test, expect } = require("@playwright/test");
const { setupRestaurant, uiLogin } = require("./helpers");

const stamp = Date.now().toString(36);
let ctx;

test.beforeAll(async ({ request }) => {
  ctx = await setupRestaurant(`pay${stamp}`, request);
});

function mockStatus(page, displayState, extra = {}) {
  return page.route("**/api/billing/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        has_restaurant: true,
        restaurant_id: ctx.id,
        restaurant_slug: "x",
        plan: "basic",
        subscription_status: "suspended",
        display_state: displayState,
        trial_ends_at: null,
        current_period_end: null,
        paddle_available: false,
        last_payment: null,
        ...extra,
      }),
    });
  });
}

test("admin suspendido ve paywall con botón Renovar", async ({ page }) => {
  await mockStatus(page, "suspended");
  await uiLogin(page, ctx.email, ctx.password, /\/admin\/billing/);
  await expect(page.getByText(/suscripción vencida|renovar/i).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: /renovar/i }).first()).toBeVisible();
});

test("mesero suspendido ve aviso elegante (sin operar)", async ({ page, request }) => {
  const API = process.env.E2E_API_URL || "http://localhost:8001";
  const wemail = `w${stamp}@e2e.co`;
  await request.post(`${API}/api/users/`, {
    headers: ctx.headers,
    data: { name: "W", email: wemail, password: "wpass1234", role: "waiter" },
  });
  await mockStatus(page, "suspended");
  await page.goto("/login");
  await page.getByPlaceholder("tu@email.com").fill(wemail);
  await page.getByPlaceholder(/••••/).fill("wpass1234");
  await page.getByRole("button", { name: /entrar al sistema/i }).click();
  await expect(page).toHaveURL(/\/waiter/, { timeout: 20000 });
  await expect(page.getByText(/restaurante en pausa/i)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/avísale al administrador/i)).toBeVisible();
});

test("trial activo muestra cuenta regresiva (sin paywall)", async ({ page, request }) => {
  const API = process.env.E2E_API_URL || "http://localhost:8001";
  // Activa trial de verdad y verifica el banner real (sin mock).
  await request.post(`${API}/api/restaurants/${ctx.id}/trial`, { headers: ctx.headers });
  await uiLogin(page, ctx.email, ctx.password, /\/admin/);
  await expect(page.getByText(/prueba termina en/i)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/restaurante en pausa/i)).toHaveCount(0);
});
