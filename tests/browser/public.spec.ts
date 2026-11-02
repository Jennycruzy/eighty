import { test, expect } from "@playwright/test";

import { PUBLIC_PAGES } from "../../shared/access";
for (const lang of ["en", "es"]) {
  test(`Public pages load signed out on a phone (${lang})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const path of [...PUBLIC_PAGES, "/states/ne"]) {
      const response = await page.goto(`${path}?lang=${lang}`);
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page).toHaveTitle(
        lang === "es" ? /Pruebas para Medicaid/ : /Medicaid proof/,
      );
      await expect(page.locator("html")).toHaveAttribute("lang", `${lang}-US`);
      if (path === "/")
        await page.screenshot({
          path: `.private/landing-${lang}.png`,
          fullPage: true,
        });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    expect(errors).toEqual([]);
  });
  test(`Confirmed taxable wages can meet after deductions (${lang})`, async ({
    page,
  }) => {
    const writes: string[] = [];
    page.on("request", (request) => {
      if (!["GET", "HEAD"].includes(request.method()))
        writes.push(request.url());
    });
    await page.goto(`/try?lang=${lang}`);
    await page.locator("#month").fill("2026-10");
    await page.locator("#gross").fill("680");
    await page.locator("#deductions").fill("100");
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", {
        name: lang === "es" ? "Revisar mi mes" : "Check my month",
        exact: true,
      })
      .click();
    await expect(page.locator(".status")).toHaveText(
      lang === "es"
        ? "Cumple la prueba de trabajo o pago"
        : "Meets the work or pay test",
    );
    await page.locator(".result summary").click();
    await expect(page.locator(".result")).toContainText("$580.00");
    await page.locator("#deductions").fill("");
    await page
      .getByRole("button", {
        name: lang === "es" ? "Revisar mi mes" : "Check my month",
        exact: true,
      })
      .click();
    await expect(page.locator(".status")).toHaveText(
      lang === "es" ? "Aún no sabemos" : "Not sure yet",
    );
    await expect(page.locator(".result")).toContainText(
      lang === "es"
        ? "Revisa las deducciones antes de impuestos"
        : "Check the pre-tax deductions",
    );
    expect(writes).toEqual([]);
    expect(
      await page.evaluate(() => ({
        local: localStorage.length,
        session: sessionStorage.length,
      })),
    ).toEqual({ local: 0, session: 0 });
  });
  test(`Gig income waits for costs and works offline (${lang})`, async ({
    page,
    context,
  }) => {
    await page.goto(`/try?lang=${lang}`);
    await page.locator("#month").fill("2026-10");
    await page.locator("#kind").selectOption("gig");
    await page.locator("#net").fill("600");
    await page.getByRole("checkbox").nth(1).check();
    const check = page.getByRole("button", {
      name: lang === "es" ? "Revisar mi mes" : "Check my month",
      exact: true,
    });
    await check.click();
    await expect(page.locator(".status")).toHaveText(
      lang === "es" ? "Aún no sabemos" : "Not sure yet",
    );
    await context.setOffline(true);
    await expect(
      page.getByRole("status").filter({
        hasText: lang === "es" ? "No tienes conexión" : "You are offline",
      }),
    ).toBeVisible();
    await page.getByRole("checkbox").nth(0).check();
    await check.click();
    await expect(page.locator(".status")).toHaveText(
      lang === "es"
        ? "Cumple la prueba de trabajo o pago"
        : "Meets the work or pay test",
    );
    await context.setOffline(false);
  });
  test(`Screener can skip every answer without inventing an exemption (${lang})`, async ({
    page,
  }) => {
    await page.goto(`/check?lang=${lang}`);
    for (let step = 0; step < 13; step++)
      await page
        .getByRole("button", {
          name: lang === "es" ? "Seguir" : "Next",
          exact: true,
        })
        .click();
    await expect(page.locator(".result h2")).toHaveText(
      lang === "es" ? "Aún no sabemos" : "Not sure yet",
    );
  });
}
