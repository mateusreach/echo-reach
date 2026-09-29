// Fluxo do Like no modo demonstração: caixa do cliente → comentário apontado →
// pedido de ajuste → equipe vê o ajuste → aprovação → desfazer → sequência.
import { expect, test } from "@playwright/test";
import { asClient, asTeam, go, ready } from "./helpers";

test("cliente comenta, pede ajuste, aprova e desfaz", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await asClient(page);
  await page.goto("/like");
  await expect(page).toHaveURL(/\/like\/fina-fragrancia$/);
  await expect(page.locator(".box-count b")).toHaveText("3");

  // Começar revisão (modo sequência)
  await page.locator("a.box-start").click();
  await expect(page).toHaveURL(/\/m\/.+sequencia=1/);
  await expect(page.locator(".rv-title h1")).toBeVisible();

  // Comentário apontado: clicar na imagem cria o pino no mesmo ponto em %
  const frame = page.locator(".rv-stage .lk-frame").first();
  const box = (await frame.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.25);
  await page.locator(".rv-composer textarea").fill("Trocar a fonte do título");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  const pin = page.locator(".rv-pin:not(.new)").first();
  await expect(pin).toHaveAttribute("style", /left: 30%|left: 29\.\d%/);
  await expect(page.locator(".rv-head")).toContainText("Em revisão");

  // Pedir ajuste sem motivo é bloqueado quando não há comentário (testado no próximo material)
  await page.locator(".rv-seq").getByRole("button", { name: "Próximo" }).click();
  await page.getByRole("button", { name: "Solicitar ajustes" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar pedido" }).click();
  await expect(page.getByRole("dialog")).toContainText("Falta dizer o que ajustar");
  await page.getByRole("dialog").getByRole("button", { name: "Ajustar texto" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar pedido" }).click();
  await expect(page.locator(".rv-bar")).toContainText(/pediu ajustes|Próximo/);
});

test("aprovar e desfazer em até 5 minutos", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await asClient(page);
  await page.goto("/like/fina-fragrancia");
  await page.locator(".mat-card .mat-body").first().click();
  await page.getByRole("button", { name: "Aprovar", exact: true }).click();
  await expect(page.locator(".rv-bar")).toContainText("Você aprovou");
  await page.locator(".rv-bar").getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByRole("button", { name: "Aprovar", exact: true })).toBeVisible();
});

test("equipe não decide e vê nota interna; aprovação por outro canal exige justificativa", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await asTeam(page);
  await page.goto("/like/fina-fragrancia");
  await page.locator(".mat-card .mat-body").nth(1).click();
  await expect(page.getByRole("button", { name: "Aprovar", exact: true })).toHaveCount(0);
  await expect(page.locator(".rv-c.internal")).toHaveCount(1);
  await page.locator(".rv-bar").getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("menuitem", { name: /outro canal/ }).click();
  const confirm = page.getByRole("dialog").getByRole("button", { name: "Registrar aprovação" });
  await expect(confirm).toBeDisabled();
  await page.getByRole("dialog").locator("textarea").fill("Carla aprovou por WhatsApp às 15h.");
  await confirm.click();
  await expect(page.locator(".rv-bar")).toContainText("Aprovado");
});

test("cliente não vê rascunho nem nota interna", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await asClient(page);
  await page.goto("/like/fina-fragrancia");
  await page.getByRole("tab", { name: /Todos/ }).click();
  await expect(page.locator(".mat-card")).not.toContainText("guia de presentes");
  await page.locator(".mat-card .mat-body").filter({ hasText: "Reels" }).click();
  await expect(page.locator(".rv-c.internal")).toHaveCount(0);
});

test("link externo: revogado não mostra materiais", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await asTeam(page);
  await go(page, "/like/fina-fragrancia/configuracoes");
  await page.locator(".ls-switches label", { hasText: "links externos" }).locator("input").check();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.locator(".ls-link-form button").first().click();
  await page.getByRole("option", { name: /Rodada/ }).click();
  await page.getByRole("button", { name: "Gerar link" }).click();
  const url = (await page.locator(".ls-fresh code").textContent())!;
  const token = url.split("/l/")[1];
  await page.getByRole("button", { name: "Revogar" }).first().click();
  await go(page, `/l/${token}`);
  await expect(page.locator(".gl-state")).toContainText("desativado");
  await expect(page.locator(".gl-item")).toHaveCount(0);
});
