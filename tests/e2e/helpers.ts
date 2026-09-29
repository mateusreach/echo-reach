import { expect, type Page } from "@playwright/test";

/** Navega sem recarregar a página: o modo demonstração guarda tudo em memória. */
export async function go(page: Page, to: string) {
  await page.evaluate(async (path) => { await (window as any).__TSR_ROUTER__.navigate({ to: path }); }, to);
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

export async function asClient(page: Page, brandName = "Fina Fragrância") {
  await page.evaluate((b) => sessionStorage.setItem("reach_view_as_client", b), brandName);
}
export async function asTeam(page: Page) {
  await page.evaluate(() => sessionStorage.removeItem("reach_view_as_client"));
}

/** Espera a app terminar de hidratar (a barra do topo aparece). */
export async function ready(page: Page) {
  await expect(page.locator(".echo-topbar")).toBeVisible();
}
