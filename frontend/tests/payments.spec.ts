import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const catalogue = JSON.parse(readFileSync(new URL("../../data/destinos.json", import.meta.url), "utf8"));
const buyer = { id: "buyer", email: "buyer@example.com", admin: false, aal: "aal1" };
const plans = [
  { plan_id: "pack_lima_pro", nombre: "Todo Lima PRO", precio_pen: 19.9, descripcion: "Todas las lomas" },
  { plan_id: "loma_individual", nombre: "Loma individual", precio_pen: 4.9, descripcion: "Una loma" },
];

async function mockApi(page: Page, { loggedIn = false, admin = false, failOrders = false } = {}) {
  const state = { user: loggedIn ? { ...buyer, admin } : null as typeof buyer | null,
    orders: [] as Array<Record<string, unknown>>, approved: false, adminCalls: 0, orderCalls: 0 };
  await page.route("https://*.tile.openstreetmap.org/**", route => route.abort());
  await page.route("https://api.mapbox.com/**", route => route.abort());
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api", "");
    const method = request.method();
    let status = 200;
    let json: unknown = {};
    if (path === "/health") json = { status: "online" };
    else if (path === "/auth/session") json = { user: state.user, csrf_token: state.user ? "test-csrf" : null };
    else if (path === "/auth/code") { status = 202; json = { message: "Código enviado" }; }
    else if (path === "/auth/verify") { state.user = buyer; json = { csrf_token: "test-csrf" }; }
    else if (path === "/auth/logout") { state.user = null; status = 204; }
    else if (path === "/auth/mfa") json = [];
    else if (path === "/billing/entitlements") json = { all_lima: state.approved, loma_ids: state.approved ? catalogue.map((l: { id: string }) => l.id) : ["L0"] };
    else if (path === "/billing/plans") json = plans;
    else if (path === "/billing/yape") json = { qr_url: "/payments/test-qr.png", recipient: "Titular de pruebas", message: "La activación requiere revisión manual del abono en Yape." };
    else if (path === "/billing/orders" && method === "GET") json = state.orders;
    else if (path === "/billing/orders" && method === "POST") {
      state.orderCalls++;
      if (failOrders) { status = 503; json = { detail: "Servicio temporalmente no disponible" }; }
      else {
        const body = request.postDataJSON();
        json = { id: "order-1", plan_id: body.plan_id, loma_id: body.loma_id || null, amount_pen: 19.9, status: "pendiente_pago", created_at: 1, reason: null };
        state.orders = [json as Record<string, unknown>]; status = 201;
      }
    } else if (path.endsWith("/reference")) {
      state.orders[0].status = "en_revision"; json = state.orders[0];
    } else if (path === "/billing/admin/orders") { state.adminCalls++; json = []; }
    else if (path === "/lomas") json = catalogue;
    else if (path === "/presets") json = [];
    else { status = 404; json = { detail: "No encontrado" }; }
    if (status === 204) await route.fulfill({ status });
    else await route.fulfill({ status, json });
  });
  // An image fixture is not a payment destination; it is never shipped in public/.
  await page.route("**/payments/test-qr.png", route => route.fulfill({ contentType: "image/png",
    body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6i0AAAAASUVORK5CYII=", "base64") }));
  return state;
}

async function openPro(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "PRO", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

test("legacy local flags cannot grant purchases and cards are absent", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("lomosoma_has_full_pack", "true");
    localStorage.setItem("lomosoma_unlocked_lomas", '["L1","L2"]');
  });
  await mockApi(page);
  await openPro(page);
  await expect(page.getByRole("button", { name: /Crear orden/ })).toBeDisabled();
  await expect(page.getByText("Todo Lima PRO activo", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog")).not.toContainText(/Tarjeta|Visa|Mastercard|CVV|Plin/);
  expect(await page.evaluate(() => localStorage.getItem("lomosoma_has_full_pack"))).toBeNull();
});

test("email login and reporting a Yape transfer stay pending until approval", async ({ page }) => {
  const state = await mockApi(page);
  await openPro(page);
  await page.getByLabel("Correo electrónico").fill("buyer@example.com");
  await page.getByRole("button", { name: "Enviar código", exact: true }).click();
  await page.getByLabel("Código recibido por correo").fill("123456");
  await page.getByRole("button", { name: "Verificar código", exact: true }).click();
  await page.getByRole("button", { name: /Crear orden/ }).click();
  await expect(page.getByRole("img", { name: "QR Yape de Titular de pruebas" })).toBeVisible();
  await page.getByLabel("Código de operación de Yape").fill("TEST1234");
  await page.getByLabel("Fecha del pago").fill("2026-10-22");
  await page.getByRole("button", { name: "Ya pagué · enviar a revisión" }).click();
  await expect(page.getByText("En revisión", { exact: true })).toBeVisible();
  await expect(page.getByText("Todo Lima PRO activo", { exact: true })).toHaveCount(0);
  expect(state.approved).toBe(false);
  expect(state.orderCalls).toBe(1);
  state.orders[0].status = "aprobado"; state.approved = true;
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(page.getByText("Todo Lima PRO activo", { exact: true })).toBeVisible();
});

test("a failed order does not turn into an offline successful purchase", async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true, failOrders: true });
  await openPro(page);
  await page.getByRole("button", { name: /Crear orden/ }).click();
  await expect(page.getByText("Servicio temporalmente no disponible", { exact: true })).toBeVisible();
  await expect(page.getByText("Todo Lima PRO activo", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Todavía no tienes órdenes.")).toBeVisible();
  expect(state.orders).toHaveLength(0);
});

test("administration waits for a second factor before fetching payment details", async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true, admin: true });
  await openPro(page);
  await page.getByRole("button", { name: "Revisar pagos", exact: true }).click();
  await expect(page.getByRole("button", { name: "Configurar autenticador" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar abono recibido" })).toHaveCount(0);
  expect(state.adminCalls).toBe(0);
});

test("payment panel fits a narrow phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockApi(page);
  await openPro(page);
  const dialog = page.getByRole("dialog");
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await page.screenshot({ path: "test-results/yape-mobile.png" });
});
