// Chat en navegador con WebSocket real en ambas direcciones.
// Sin mocks de red: usa el stack e2e completo.
const { test, expect } = require("@playwright/test");
const { setupRestaurant, setupMenuTable } = require("./helpers");

const API = process.env.E2E_API_URL || "http://localhost:8001";
const stamp = Date.now().toString(36);
let ctx;
let tableQr;
let sessionId;
let sessionToken;

test.beforeAll(async ({ request }) => {
  ctx = await setupRestaurant(`cht${stamp}`, request);
  const setup = await setupMenuTable(request, ctx.headers, `C${stamp}`);
  tableQr = setup.tableQr;
  // Activa trial para que el chat opere (el gate bloquea registrados).
  await request.post(`${API}/api/restaurants/${ctx.id}/trial`, { headers: ctx.headers });

  const session = await request.post(`${API}/api/chat/sessions/${tableQr}`);
  if (session.status() !== 201) throw new Error("setup chat: " + (await session.text()));
  const data = await session.json();
  sessionId = data.id;
  sessionToken = data.access_token;
  if (!sessionToken) throw new Error("setup chat: sin access_token");
});

test("cliente envía por WS y el mesero lo recibe en tiempo real", async ({ page, context }) => {
  // Cliente anónimo entra con token de sesión.
  await page.goto(`/chat/${sessionId}?token=${encodeURIComponent(sessionToken)}`);
  await page.getByPlaceholder(/escribí un mensaje/i).fill("Hola, ¿cuánto demora?");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Hola, ¿cuánto demora?")).toBeVisible({ timeout: 20000 });

  // Mesero en segundo contexto, con su JWT.
  const wemail = `wchat-${stamp}@e2e.co`;
  await context.request.post(`${API}/api/users/`, {
    headers: ctx.headers,
    data: { name: "W", email: wemail, password: "wpass1234", role: "waiter" },
  });
  const staff = await context.newPage();
  await staff.goto("/login");
  await staff.getByPlaceholder("tu@email.com").fill(wemail);
  await staff.getByPlaceholder(/••••/).fill("wpass1234");
  await staff.getByRole("button", { name: /entrar al sistema/i }).click();
  await expect(staff).toHaveURL(/\/waiter/, { timeout: 20000 });

  // El mesero abre el mismo chat (con JWT, sin token de sesión).
  await staff.goto(`/chat/${sessionId}`);
  await expect(staff.getByText("Hola, ¿cuánto demora?")).toBeVisible({ timeout: 20000 });

  // Respuesta del mesero → el cliente la ve en tiempo real por WS.
  await staff.getByPlaceholder(/escribí un mensaje/i).fill("Unos 15 minutos");
  await staff.keyboard.press("Enter");
  await expect(page.getByText("Unos 15 minutos")).toBeVisible({ timeout: 20000 });
});
