// Humo E2E: landing → registro → trial → pedido QR → mesero.
// Requiere backend+frontend levantados (playwright.config.js webServer).
// Datos únicos por corrida (timestamp) para no chocar entre runs.
const { test, expect } = require("@playwright/test");

const API = process.env.E2E_API_URL || "http://localhost:8001";
const stamp = Date.now().toString(36);
const SLUG = `e2e-${stamp}`;
const EMAIL = `owner-${stamp}@e2e.co`;
const PASSWORD = "e2epass123";
const PRODUCT = `Bandeja E2E ${stamp}`;

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

test.describe("flujo dueño: landing, registro y trial", () => {
  test("landing muestra CTAs y el registro crea el restaurante", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /probar gratis 14 días/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /ver demo en vivo/i })).toBeVisible();

    await page.getByRole("button", { name: /probar gratis 14 días/i }).first().click();
    await expect(page).toHaveURL(/\/register/);

    await page.getByPlaceholder("Nombre del restaurante").fill(`E2E ${stamp}`);
    await page.getByPlaceholder("mi-restaurante").fill(SLUG);
    await page.getByPlaceholder("Tu nombre").fill("Dueña E2E");
    await page.getByPlaceholder("Correo electrónico").fill(EMAIL);
    await page.getByPlaceholder(/Contraseña/).fill(PASSWORD);
    await page.getByRole("button", { name: /crear mi restaurante/i }).click();

    await expect(page).toHaveURL(/\/admin/, { timeout: 20000 });
    await expect(page.getByText(/activa tu prueba gratuita/i)).toBeVisible({ timeout: 15000 });
  });

  test("activar trial habilita la operación", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("tu@email.com").fill(EMAIL);
    await page.getByPlaceholder(/••••/).fill(PASSWORD);
    await page.getByRole("button", { name: /entrar al sistema/i }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 20000 });

    await page.getByRole("button", { name: /activar prueba/i }).click();
    await expect(page.getByText(/prueba termina en/i)).toBeVisible({ timeout: 15000 });
  });
});

test.describe("flujo cliente: QR, pedido y mesero", () => {
  let qr;
  let adminToken;

  test.beforeAll(async () => {
    // Setup por API: login, categoría, producto y mesa.
    const login = await api("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: EMAIL, password: PASSWORD }),
    });
    if (login.status !== 200) throw new Error("setup: login falló " + JSON.stringify(login.body));
    adminToken = login.body.access_token;
    const auth = { Authorization: `Bearer ${adminToken}` };

    const cat = await api("/api/menu/categories", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ name: "Platos E2E" }),
    });
    if (cat.status !== 201) throw new Error("setup: categoría " + JSON.stringify(cat.body));

    const prod = await api("/api/menu/products", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ name: PRODUCT, price: 25000, category_id: cat.body.id }),
    });
    if (prod.status !== 201) throw new Error("setup: producto " + JSON.stringify(prod.body));

    const table = await api("/api/tables/", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ number: 7, capacity: 4 }),
    });
    if (table.status !== 201) throw new Error("setup: mesa " + JSON.stringify(table.body));
    qr = table.body.qr_code;
  });

  test("cliente pide por QR y el mesero lo confirma y entrega", async ({ page, context }) => {
    // Cliente anónimo pide desde el menú QR.
    await page.goto(`/menu/${qr}`);
    await expect(page.getByText(PRODUCT)).toBeVisible({ timeout: 20000 });
    await page.getByPlaceholder("Buscar en el menú...").fill(PRODUCT);
    const addBtn = page.locator("button").filter({ has: page.locator("svg.lucide-plus") }).first();
    await addBtn.click();
    await page.getByRole("button", { name: /pedido/i }).click();
    await page.getByRole("button", { name: /enviar pedido a cocina/i }).click();
    await expect(page).toHaveURL(/\/order\/\d+/, { timeout: 20000 });
    await expect(page.getByText(PRODUCT)).toBeVisible({ timeout: 15000 });

    // Mesero (admin) confirma y entrega en otra pestaña.
    const staff = await context.newPage();
    await staff.goto("/login");
    await staff.getByPlaceholder("tu@email.com").fill(EMAIL);
    await staff.getByPlaceholder(/••••/).fill(PASSWORD);
    await staff.getByRole("button", { name: /entrar al sistema/i }).click();
    await expect(staff).toHaveURL(/\/admin/, { timeout: 20000 });
    await staff.goto("/waiter");
    await expect(staff.getByText(PRODUCT)).toBeVisible({ timeout: 20000 });
    await staff.getByRole("button", { name: /confirmar/i }).first().click();
    await staff.getByRole("button", { name: /activos/i }).click();
    await expect(staff.getByText(/confirmado/i).first()).toBeVisible({ timeout: 15000 });

    // La cocina lo avanza a listo (vía API con rol kitchen) y el mesero entrega.
    const kitchenLogin = await (
      await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: `cocina-${stamp}@e2e.co`, password: "kpass1234" }),
      }).catch(() => null)
    );
    let kitchenToken = null;
    if (!kitchenLogin || kitchenLogin.status !== 200) {
      const created = await fetch(`${API}/api/users/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ name: "Cocina", email: `cocina-${stamp}@e2e.co`, password: "kpass1234", role: "kitchen" }),
      });
      if (created.status !== 201) throw new Error("setup: cocina " + (await created.text()));
      const kl = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: `cocina-${stamp}@e2e.co`, password: "kpass1234" }),
      });
      kitchenToken = (await kl.json()).access_token;
    } else {
      kitchenToken = (await kitchenLogin.json()).access_token;
    }
    const kh = { Authorization: `Bearer ${kitchenToken}`, "Content-Type": "application/json" };
    const ordersList = await (await fetch(`${API}/api/orders/kitchen`, { headers: kh })).json();
    const oid = ordersList[0].id;
    for (const s of ["preparing", "ready"]) {
      const r = await fetch(`${API}/api/orders/${oid}/status`, {
        method: "PATCH", headers: kh, body: JSON.stringify({ status: s }),
      });
      if (r.status !== 200) throw new Error("setup: estado " + s + " " + (await r.text()));
    }
    await staff.getByRole("button", { name: /entregar/i }).first().click();
    await staff.getByRole("button", { name: /entregados/i }).click();
    await expect(staff.getByText(/entregado/i).first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe("demo pública", () => {
  test("/demo carga sin login", async ({ page, request }) => {
    // Garantiza restaurante demo + admin con las credenciales que usa la
    // página demo (NEXT_PUBLIC_DEMO_* o sus defaults). Si ya existe de
    // otra corrida (400), se reutiliza: la clave nunca cambia.
    const demoSignup = await request.post(`${API}/api/restaurants/signup`, {
      data: {
        name: "Demo", slug: "demo", admin_name: "D",
        admin_email: "demo@restaurant.com", admin_password: "demo1234", website: "",
      },
    });
    if (demoSignup.status() === 201) {
      const d = await demoSignup.json();
      const dh = { Authorization: `Bearer ${d.access_token}` };
      await request.post(`${API}/api/restaurants/${d.id}/trial`, { headers: dh });
      const cat = await request.post(`${API}/api/menu/categories`, {
        headers: dh, data: { name: "Demo Platos" },
      });
      const catId = (await cat.json()).id;
      await request.post(`${API}/api/menu/products`, {
        headers: dh, data: { name: "Plato Demo", price: 15000, category_id: catId },
      });
      await request.post(`${API}/api/tables/`, {
        headers: dh, data: { number: 1, capacity: 2 },
      });
    }

    await page.goto("/demo");
    await expect(page.getByText(/así se ve tu restaurante/i)).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/crear el mío gratis/i)).toBeVisible();

    // Entra al panel demo: debe verse el marco DEMO, sin CTAs de compra.
    await page.getByRole("button", { name: /explorar el panel demo/i }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 20000 });
    await expect(page.getByText(/estás explorando la demo/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/activa tu prueba gratuita/i)).toHaveCount(0);
    await expect(page.getByText(/pon tu restaurante a vender/i)).toHaveCount(0);
  });

  test("tour demo: panel → cliente → mesero → cocina → reiniciar → salir", async ({ page, request }) => {
    // La demo ya la garantiza el test anterior (misma BD, workers: 1).
    const login = await request.post(`${API}/api/auth/login`, {
      form: { username: "demo@restaurant.com", password: "demo1234" },
    });
    if (login.status() !== 200) test.skip(true, "sin credenciales demo");
    const demoHeaders = { Authorization: `Bearer ${(await login.json()).access_token}` };

    // Parte del tour con la demo recién restaurada (el reset re-siembra la
    // carta canónica, así que mesa y producto se leen DESPUÉS de él).
    await request.post(`${API}/api/restaurants/demo/reset`, { headers: demoHeaders });
    const overview = await request.get(`${API}/api/restaurants/demo/overview`);
    if (overview.status() !== 200) test.skip(true, "sin restaurante demo");
    const { table_qr: tableQr, categories } = await overview.json();
    const firstProduct = categories.flatMap((c) => c.products)[0];
    const productId = firstProduct?.id;
    const productName = firstProduct?.name || "";
    if (!tableQr || !productId || !productName) test.skip(true, "demo sin mesa o productos");

    await page.goto("/demo");
    await page.getByRole("button", { name: /explorar el panel demo/i }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 20000 });
    await expect(page.getByText(/tour demo/i).first()).toBeVisible({ timeout: 15000 });
    // En el tour no hay "Cerrar sesión": la única salida es el botón Salir.
    await expect(page.getByRole("button", { name: /cerrar sesión/i })).toHaveCount(0);
    // Misión del panel + guías de carta y mesas.
    await expect(page.getByText(/paso 1 de 4/i)).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: /^menú$/i }).click();
    await expect(page).toHaveURL(/\/admin\/menu/, { timeout: 15000 });
    await expect(page.getByText(/mueve un plato de una a otra/i)).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: /^mesas$/i }).click();
    await expect(page).toHaveURL(/\/admin\/tables/, { timeout: 15000 });
    await expect(page.getByText(/cada mesa tiene su qr/i)).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: /^panel$/i }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });

    // Cliente: vista pública del menú con barra de retorno al tour.
    await page.getByRole("button", { name: /^cliente$/i }).click();
    await expect(page).toHaveURL(/\/menu\/.+\?.*tour=1/, { timeout: 20000 });
    await expect(page.getByText(/vista cliente/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/paso 2 de 4/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(productName, { exact: false }).first()).toBeVisible({ timeout: 15000 });

    // El "cliente" pide de verdad (pedido público con el QR demo).
    const order = await request.post(`${API}/api/orders/`, {
      data: { table_qr: tableQr, items: [{ product_id: productId, quantity: 1 }] },
    });
    expect(order.status()).toBe(201);
    const orderId = (await order.json()).id;

    // Mesero: el pedido pendiente aparece (la vista cliente solo tiene
    // retorno al tour, los tabs completos están en panel/mesero/cocina).
    await page.getByRole("button", { name: /volver al tour/i }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
    await page.getByRole("button", { name: /^mesero$/i }).click();
    await expect(page).toHaveURL(/\/waiter/, { timeout: 20000 });
    await expect(page.getByText(/paso 3 de 4/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(productName, { exact: false }).first()).toBeVisible({ timeout: 20000 });

    // Cocina: tras confirmar, el pedido aparece en cocina.
    const confirm = await request.patch(`${API}/api/orders/${orderId}/status`, {
      headers: demoHeaders, data: { status: "confirmed" },
    });
    expect(confirm.status()).toBe(200);
    await page.getByRole("button", { name: /^cocina$/i }).click();
    await expect(page).toHaveURL(/\/kitchen/, { timeout: 15000 });
    await expect(page.getByText(/paso 4 de 4/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(productName, { exact: false }).first()).toBeVisible({ timeout: 20000 });

    // Reiniciar: confirma el diálogo y espera la recarga real (si el reset
    // no disparara, waitForNavigation falla fuerte en vez de pasar de largo).
    await page.getByRole("button", { name: /^panel$/i }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
    page.once("dialog", (d) => d.accept());
    await Promise.all([
      page.waitForNavigation({ waitUntil: "load", timeout: 20000 }),
      page.getByRole("button", { name: /reiniciar/i }).click(),
    ]);
    const orders = await request.get(`${API}/api/orders/`, { headers: demoHeaders });
    expect(orders.status()).toBe(200);
    expect(await orders.json()).toHaveLength(0);

    // Regresión: tras reiniciar por botón, la pestaña Cliente debe cargar el
    // menú (el QR ya no muere con el reset y el caché se limpia).
    await page.getByRole("button", { name: /^cliente$/i }).click();
    await expect(page).toHaveURL(/\/menu\/.+\?.*tour=1/, { timeout: 20000 });
    await expect(page.getByText(/vista cliente/i)).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: /volver al tour/i }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });

    // Salir: vuelve a /demo sin sesión ni flag de tour.
    await page.getByRole("button", { name: /salir/i }).click();
    await expect(page).toHaveURL(/\/demo/, { timeout: 15000 });
    expect(await page.evaluate(() => localStorage.getItem("demo_tour"))).toBeNull();
  });

  test("tour demo en móvil: sidebar por encima de la barra y barra a ancho completo", async ({ page, request }) => {
    const login = await request.post(`${API}/api/auth/login`, {
      form: { username: "demo@restaurant.com", password: "demo1234" },
    });
    if (login.status() !== 200) test.skip(true, "sin credenciales demo");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/demo");
    await page.getByRole("button", { name: /explorar el panel demo/i }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 20000 });
    // En móvil el pill "TOUR DEMO" se oculta; los tabs son la señal visible.
    await expect(page.getByRole("button", { name: /^cocina$/i })).toBeVisible({ timeout: 15000 });

    // Abrir el drawer (botón hamburguesa del header móvil): el aside debe
    // quedar por encima de la barra del tour.
    await page.locator("header.sticky button").first().click();
    const z = await page.evaluate(() => {
      const zi = (el) => Number(getComputedStyle(el).zIndex || 0);
      const aside = document.querySelector("aside");
      const bar = [...document.querySelectorAll("div")].find((d) =>
        d.textContent.includes("TOUR DEMO") && getComputedStyle(d).position === "sticky"
      );
      return { aside: aside ? zi(aside) : -1, bar: bar ? zi(bar) : -1 };
    });
    expect(z.aside).toBeGreaterThan(z.bar);

    // Mesero: cerrar el drawer tocando el overlay y verificar que la barra
    // va a ancho completo (borde izquierdo en x=0).
    await page.mouse.click(350, 400);
    await page.getByRole("button", { name: /^mesero$/i }).click();
    await expect(page).toHaveURL(/\/waiter/, { timeout: 15000 });
    await expect(page.getByRole("button", { name: /^mesero$/i })).toBeVisible({ timeout: 15000 });
    const left = await page.evaluate(() => {
      const bar = [...document.querySelectorAll("div")].find((d) =>
        d.textContent.includes("TOUR DEMO") && getComputedStyle(d).position === "sticky"
      );
      return bar ? bar.getBoundingClientRect().left : -1;
    });
    expect(left).toBe(0);
  });
});
