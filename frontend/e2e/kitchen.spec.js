// Cocina en navegador + tracking + chat real por WS.
const { test, expect } = require("@playwright/test");
const { setupRestaurant, setupMenuTable, uiLogin } = require("./helpers");

const API = process.env.E2E_API_URL || "http://localhost:8001";
const stamp = Date.now().toString(36);
const PRODUCT = `PlatoK${stamp}`;
let ctx;
let qr;

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function findProductId() {
  const cats = await api(`/api/menu/?table_qr=${qr}`, { headers: ctx.headers });
  for (const c of cats.body) for (const p of c.products || []) {
    if (p.name === PRODUCT) return p.id;
  }
  throw new Error("producto setup no encontrado");
}

test.beforeAll(async ({ request }) => {
  ctx = await setupRestaurant(`kit${stamp}`, request);
  const setup = await setupMenuTable(request, ctx.headers, `K${stamp}`);
  qr = setup.tableQr;
  // Renombra el producto para identificarlo en la UI.
  const pid = await findProductIdVia(request);
  async function findProductIdVia(req) {
    const cats = await req.get(`${API}/api/menu/?table_qr=${qr}`, { headers: ctx.headers });
    const list = await cats.json();
    for (const c of list) for (const p of c.products || []) {
      if (p.name.startsWith("PlatoK")) return p.id;
    }
    throw new Error("x");
  }
  await request.patch(`${API}/api/menu/products/${pid}`, {
    headers: ctx.headers, data: { name: PRODUCT },
  });
  // Cocinero para el login UI.
  await request.post(`${API}/api/users/`, {
    headers: ctx.headers,
    data: { name: "Cocina", email: `cocina-${stamp}@e2e.co`, password: "cpass1234", role: "kitchen" },
  });
});

test("cocina avanza el pedido en su pantalla", async ({ page }) => {
  const created = await api("/api/orders/", {
    method: "POST",
    body: JSON.stringify({
      table_qr: qr, order_type: "dine_in", items: [{ product_id: await findProductId(), quantity: 1 }],
    }),
  });
  const orderId = created.body.id;
  await api(`/api/orders/${orderId}/status`, {
    method: "PATCH", headers: ctx.headers, body: JSON.stringify({ status: "confirmed" }),
  });

  await uiLogin(page, `cocina-${stamp}@e2e.co`, "cpass1234", /\/kitchen/);
  await expect(page.getByText(PRODUCT)).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: /iniciar preparación/i }).first().click();
  await expect(page.getByText(/en preparación/i).first()).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /marcar como listo/i }).first().click();
  await expect(page.getByText(/listo/i).first()).toBeVisible({ timeout: 15000 });
});

test("tracking muestra el pedido y el chat envía por WS", async ({ page }) => {
  const created = await api("/api/orders/", {
    method: "POST",
    body: JSON.stringify({
      table_qr: qr, order_type: "dine_in", customer_name: "E2E",
      items: [{ product_id: await findProductId(), quantity: 1 }],
    }),
  });
  const orderId = created.body.id;

  await page.goto(`/order/${orderId}`);
  await expect(page.getByText(PRODUCT)).toBeVisible({ timeout: 20000 });

  await page.getByRole("button", { name: /hablar con el mesero/i }).click();
  await expect(page).toHaveURL(/\/chat\//, { timeout: 20000 });
  await page.getByPlaceholder(/escribí un mensaje/i).fill("Hola, ¿cuánto demora?");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Hola, ¿cuánto demora?")).toBeVisible({ timeout: 20000 });
});
