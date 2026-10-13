// Aviso de suspensión/vencimiento para staff (mesero/cocina) con status mockeado.
// El backend de estos 402 ya está cubierto en pytest; aquí se valida la UI.
const { test, expect } = require("@playwright/test");
const { setupRestaurant, uiLogin } = require("./helpers");

const API = process.env.E2E_API_URL || "http://localhost:8001";
const stamp = Date.now().toString(36);
let ctx;
let staffCreds = {};

function mockStatus(page, displayState) {
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
      }),
    });
  });
}

test.beforeAll(async ({ request }) => {
  ctx = await setupRestaurant(`stf${stamp}`, request);
  for (const [role, email] of [["waiter", `w-${stamp}@e2e.co`], ["kitchen", `c-${stamp}@e2e.co`]]) {
    await request.post(`${API}/api/users/`, {
      headers: ctx.headers,
      data: { name: role, email, password: "staffpass123", role },
    });
    staffCreds[role] = { email, password: "staffpass123" };
  }
});

async function loginStaff(page, role, urlPattern) {
  await page.goto("/login");
  await page.getByPlaceholder("tu@email.com").fill(staffCreds[role].email);
  await page.getByPlaceholder(/••••/).fill(staffCreds[role].password);
  await page.getByRole("button", { name: /entrar al sistema/i }).click();
  await expect(page).toHaveURL(urlPattern, { timeout: 20000 });
}

for (const [role, url] of [["waiter", /\/waiter/], ["kitchen", /\/kitchen/]]) {
  for (const state of ["suspended", "expired"]) {
    test(`${role} ve aviso elegante cuando el estado es ${state}`, async ({ page }) => {
      await mockStatus(page, state);
      await loginStaff(page, role, url);
      const target = role === "waiter" ? "/waiter" : "/kitchen";
      await page.goto(target);
      await expect(page.getByText(/restaurante en pausa/i)).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/avísale al administrador/i)).toBeVisible();
      // No debe verse la UI operativa (listas de pedidos).
      await expect(page.getByText(/confirmado|en preparación/i).first()).toHaveCount(0);
    });
  }

  test(`${role} ve aviso de inactividad si no hay trial`, async ({ page }) => {
    await mockStatus(page, "registered");
    await loginStaff(page, role, url);
    const target = role === "waiter" ? "/waiter" : "/kitchen";
    await page.goto(target);
    await expect(page.getByRole("heading", { name: /aún no activo/i })).toBeVisible({ timeout: 15000 });
  });
}
