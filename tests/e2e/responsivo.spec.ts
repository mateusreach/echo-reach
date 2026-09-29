// Nenhuma página pode ter rolagem horizontal em 360, 768, 1024 e 1440 px (página 25, F3).
import { expect, test } from "@playwright/test";

const PAGES = [
  "/", "/agencia", "/agencia/clientes", "/agencia/equipe", "/clientes/fina-fragrancia",
  "/b/fina-fragrancia/biblioteca", "/b/fina-fragrancia/plano", "/workspace", "/workspace/controle", "/workspace/demandas",
  "/e360", "/e360/fina-fragrancia", "/like", "/like/painel", "/like/fina-fragrancia", "/like/fina-fragrancia/grade",
  "/like/fina-fragrancia/calendario", "/like/fina-fragrancia/historico", "/like/fina-fragrancia/configuracoes", "/pesquisa?q=outono",
];

for (const width of [360, 768, 1024, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    for (const path of PAGES) {
      test(`sem rolagem horizontal em ${path}`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator(".echo-topbar")).toBeVisible();
        await page.waitForTimeout(800);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(over, `${path} passa ${over}px da largura`).toBeLessThanOrEqual(0);
      });
    }
  });
}
