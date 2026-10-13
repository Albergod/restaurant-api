// E2E con Playwright (chromium). Levanta backend+frontend de prueba.
// Uso: npx playwright test
// Requiere PostgreSQL con una BD dedicada (ver TESTING.md / CI).
// Vars opcionales: E2E_REPO, E2E_API_URL, E2E_WEB_URL, E2E_DB_URL,
// E2E_LD_LIBRARY_PATH, E2E_ALLOW_REGISTRATION.
const { defineConfig } = require("@playwright/test");

const REPO = process.env.E2E_REPO || "/home/kaydo/Desktop/restaurant-api";
const API_URL = process.env.E2E_API_URL || "http://localhost:8001";
const WEB_URL = process.env.E2E_WEB_URL || "http://localhost:3100";
const DB_URL =
  process.env.E2E_DB_URL ||
  "postgresql+asyncpg://kaydo:1234@localhost:5432/restaurant_e2e";
const WS_URL = API_URL.replace(/^http/, "ws");
const PY = process.env.E2E_PYTHON || ".venv/bin/python";
const LD_LIB =
  process.env.E2E_LD_LIBRARY_PATH ||
  "/nix/store/ggl9s54yad1334ajblw1c6i2a0avkc21-postgresql-18.6-lib/lib:/nix/store/604gsr59rj7dzd0nrhp143rpvf7gyiaz-gcc-15.3.0-lib/lib";

module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 90000,
  retries: 0,
  workers: 1, // serie: comparten la misma BD de prueba
  use: {
    baseURL: WEB_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    launchOptions: process.env.E2E_CHROMIUM
      ? { executablePath: process.env.E2E_CHROMIUM, args: ["--no-sandbox"] }
      : { args: ["--no-sandbox"] },
  },
  webServer: [
    {
      command:
        `bash -c 'export LD_LIBRARY_PATH=${LD_LIB}:$LD_LIBRARY_PATH; cd ${REPO} && ` +
        `DATABASE_URL=${DB_URL} ` +
        `SEED_DEFAULT_USERS=false ALLOW_PUBLIC_STAFF_REGISTRATION=${process.env.E2E_ALLOW_REGISTRATION || "false"} ` +
        `BACKEND_CORS_ORIGINS=${WEB_URL} FRONTEND_URL=${WEB_URL} ` +
        `${PY} -m uvicorn app.main:app --host 127.0.0.1 --port 8001'`,
      url: `${API_URL}/`,
      timeout: 120000,
      // false a propósito: reutilizar un servidor viejo en silencio ha causado
      // falsos rojos (backend sin las env de este run). Mejor fallar fuerte.
      reuseExistingServer: false,
      stdout: "pipe",
    },
    {
      command:
        `bash -c 'cd ${REPO}/frontend && ` +
        `NEXT_PUBLIC_API_URL=${API_URL} NEXT_PUBLIC_WS_URL=${WS_URL} ` +
        `npm run build >/dev/null 2>&1; ` +
        `NEXT_PUBLIC_API_URL=${API_URL} NEXT_PUBLIC_WS_URL=${WS_URL} ` +
        `npm start -- --port 3100 --hostname 127.0.0.1'`,
      url: WEB_URL,
      timeout: 300000,
      reuseExistingServer: false,
    },
  ],
});
