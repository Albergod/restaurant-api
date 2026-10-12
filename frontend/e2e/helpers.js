// Helpers compartidos de los specs E2E.
const { expect } = require("@playwright/test");
const API = process.env.E2E_API_URL || "http://localhost:8001";

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function apiLogin(username, password) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }),
  });
  const body = await res.json();
  if (res.status !== 200) throw new Error("login falló: " + JSON.stringify(body));
  return body.access_token;
}

// Crea restaurante + admin + trial activo vía API. Retorna {id, slug, email, password, token, headers}.
async function setupRestaurant(tag, request) {
  const slug = `e2e-${tag}-${Date.now().toString(36)}`;
  const email = `owner-${tag}-${Date.now().toString(36)}@e2e.co`;
  const password = "e2epass123";
  const signup = await request.post(`${API}/api/restaurants/signup`, {
    data: {
      name: `E2E ${tag}`, slug, admin_name: "Owner",
      admin_email: email, admin_password: password, website: "",
    },
  });
  if (signup.status() !== 201) throw new Error("setup signup: " + (await signup.text()));
  const created = await signup.json();
  const headers = { Authorization: `Bearer ${created.access_token}` };
  const trial = await request.post(`${API}/api/restaurants/${created.id}/trial`, { headers });
  if (trial.status() !== 201) throw new Error("setup trial: " + (await trial.text()));
  return { id: created.id, slug, email, password, token: created.access_token, headers };
}

async function setupMenuTable(request, headers, suffix = "") {
  const cat = await request.post(`${API}/api/menu/categories`, {
    headers, data: { name: `Cat${suffix}` },
  });
  const catId = (await cat.json()).id;
  const prod = await request.post(`${API}/api/menu/products`, {
    headers, data: { name: `Plato${suffix}`, price: 20000, category_id: catId },
  });
  const productId = (await prod.json()).id;
  const table = await request.post(`${API}/api/tables/`, {
    headers, data: { number: 1, capacity: 4 },
  });
  const tableQr = (await table.json()).qr_code;
  return { catId, productId, tableQr };
}

async function uiLogin(page, email, password, expectUrl) {
  await page.goto("/login");
  await page.getByPlaceholder("tu@email.com").fill(email);
  await page.getByPlaceholder(/••••/).fill(password);
  await page.getByRole("button", { name: /entrar al sistema/i }).click();
  await expect(page).toHaveURL(expectUrl, { timeout: 20000 });
}

module.exports = { API, api, apiLogin, setupRestaurant, setupMenuTable, uiLogin };
