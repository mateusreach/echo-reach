// Echo · testes ponta a ponta (página 25, F2)
// Instalar uma vez:  npm i -D @playwright/test && npx playwright install chromium
// Rodar:            npx playwright test
// Sem VITE_SUPABASE_URL os testes usam o modo demonstração (dados em memória).
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 1,
  use: { baseURL: process.env.ECHO_URL ?? "http://localhost:5410", trace: "retain-on-failure", locale: "pt-BR" },
  webServer: process.env.ECHO_URL ? undefined : { command: "npm run dev -- --port 5410 --strictPort", url: "http://localhost:5410", reuseExistingServer: true, timeout: 180_000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "celular", use: { ...devices["Pixel 7"] }, testMatch: /responsivo|like-cliente/ },
  ],
});
