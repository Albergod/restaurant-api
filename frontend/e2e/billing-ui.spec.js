// Billing UI sin llaves Paddle: cableado del checkout con Paddle stub.
// El cobro real queda pendiente de llaves sandbox (PADDLE-PENDIENTE.md).
const { test, expect } = require("@playwright/test");
const { setupRestaurant, uiLogin } = require("./helpers");

const stamp = Date.now().toString(36);
let ctx;

test.beforeAll(async ({ request }) => {
  ctx = await setupRestaurant(`bil${stamp}`, request);
});

test.beforeEach(async ({ page }) => {
  // Stub de window.Paddle antes de que cargue cualquier script.
  await page.addInitScript(() => {
    window.__paddleCalls = [];
    window.Paddle = {
      Initialize: () => {},
      Checkout: {
        open: (args) => {
          window.__paddleCalls.push(args);
        },
      },
    };
  });
});

async function mockCheckout(page, transactionId = "txn_test_123") {
  await page.route("**/api/billing/paddle/checkout", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ transaction_id: transactionId, checkout_url: "https://checkout.paddle.test/x" }),
    });
  });
}

test("sin llaves muestra aviso elegante, no crash", async ({ page }) => {
  await uiLogin(page, ctx.email, ctx.password, /\/admin/);
  await page.goto("/admin/billing");
  await expect(page.getByText(/pago internacional aún no está configurado|no configurado/i).first()).toBeVisible({
    timeout: 15000,
  });
});

test("con checkout mockeado llama a Paddle con el transaction_id", async ({ page }) => {
  // Simula backend configurado: config con paddle disponible + checkout mock.
  await page.route("**/api/billing/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        paddle_available: true,
        paddle_env: "sandbox",
        paddle_client_token: "test_client_token",
        cycles: {
          monthly: { days: 30, cents_usd: 999 },
          biweekly: { days: 15, cents_usd: 599 },
        },
      }),
    });
  });
  await mockCheckout(page, "txn_ui_456");
  await uiLogin(page, ctx.email, ctx.password, /\/admin/);
  await page.goto("/admin/billing");
  await page.getByRole("button", { name: /pagar con tarjeta/i }).first().click();
  await expect
    .poll(
      async () =>
        page.evaluate(() => (window.__paddleCalls || []).map((c) => c.transactionId)),
      { timeout: 15000 }
    )
    .toContain("txn_ui_456");
});
