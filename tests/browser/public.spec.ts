import { test, expect, type Page, type Locator } from "@playwright/test";
async function keyOn(page: Page, control: Locator, key = "Enter") {
  for (let i = 0; i < 70; i++) {
    if (await control.evaluate((el) => el === document.activeElement)) {
      await page.keyboard.press(key);
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("A control could not be reached by keyboard.");
}

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
    for (let index = 0; index < 14; index++)
      await keyOn(
        page,
        page.getByRole("button", {
          name: lang === "es" ? "No sé" : "I’m not sure",
          exact: true,
        }),
      );
    await expect(page.locator(".result h2")).toHaveText(
      lang === "es" ? "Aún no sabemos" : "Not sure yet",
    );
  });
}

for (const lang of ["en", "es"]) {
  test(`Screener gives a reason, proof and a working closed account link (${lang})`, async ({
    page,
  }) => {
    await page.goto(`/check?lang=${lang}`);
    for (let index = 0; index < 14; index++) {
      await expect(page.locator("fieldset")).toHaveCount(1);
      await expect(
        page.getByRole("button", {
          name: lang === "es" ? "No sé" : "I’m not sure",
          exact: true,
        }),
      ).toBeVisible();
      if (index === 0) await page.locator("#state").selectOption("NE");
      if (index === 2) await page.locator("#age").fill("34");
      if (index === 5) await page.locator("input[type=radio]").first().check();
      await page
        .getByRole("button", {
          name: lang === "es" ? "Seguir" : "Next",
          exact: true,
        })
        .click();
    }
    await expect(page.locator(".result")).toHaveAttribute(
      "data-outcome",
      "excluded",
    );
    await expect(
      page.getByRole("heading", {
        name:
          lang === "es" ? "Qué guardar como prueba" : "What to keep as proof",
      }),
    ).toBeVisible();
    await expect(page.locator(".result")).toContainText(
      lang === "es" ? "edad del niño" : "child’s age",
    );
    await page.locator(".result summary").click();
    await expect(page.locator(".result")).toContainText("435.554(c)(3)");
    await page
      .getByRole("link", {
        name: lang === "es" ? "Seguir mis meses" : "Track my months",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/check/account${lang === "es" ? "\\?lang=es" : ""}$`),
    );
    await expect(
      page.getByRole("heading", {
        name:
          lang === "es"
            ? "Aún no puedes crear una cuenta"
            : "Account creation is closed",
      }),
    ).toBeVisible();
    await expect(page.locator("dl")).toContainText("NE");
    await expect(page.locator("dl")).toContainText("34");
    await expect(page.locator("input[type=email]")).toHaveCount(0);
    await page
      .getByRole("link", {
        name: lang === "es" ? "Volver a mis respuestas" : "Back to my answers",
      })
      .click();
    await expect(page.locator(".result")).toHaveAttribute(
      "data-outcome",
      "excluded",
    );
    await expect(page.locator("body")).not.toContainText("Sign in to continue");
  });
}

for (const lang of ["en", "es"]) {
  test(`Both landing doors work by keyboard (${lang})`, async ({ page }) => {
    await page.goto(`/?lang=${lang}`);
    await keyOn(
      page,
      page.getByRole("link", {
        name:
          lang === "es" ? "Revisar si me aplica" : "Check if it applies to me",
        exact: true,
      }),
    );
    await expect(page.locator("fieldset")).toHaveCount(1);
    await page.goto(`/?lang=${lang}`);
    await keyOn(
      page,
      page.getByRole("link", {
        name: lang === "es" ? "Revisar un mes" : "Check a month",
        exact: true,
      }),
    );
    await expect(page.locator("#month")).toBeVisible();
  });
  test(`All initial answers give a conditional result by keyboard (${lang})`, async ({
    page,
  }) => {
    await page.goto(`/check?lang=${lang}`);
    await keyOn(page, page.locator("#state"), "n");
    await keyOn(
      page,
      page.getByRole("button", {
        name: lang === "es" ? "Seguir" : "Next",
        exact: true,
      }),
    );
    await keyOn(
      page,
      page.getByRole("button", {
        name: lang === "es" ? "Seguir" : "Next",
        exact: true,
      }),
    );
    await keyOn(page, page.locator("#age"), "3");
    await page.keyboard.type("4");
    await keyOn(
      page,
      page.getByRole("button", {
        name: lang === "es" ? "Seguir" : "Next",
        exact: true,
      }),
    );
    for (let step = 2; step < 13; step++) {
      await keyOn(page, page.locator("input[type=radio]:checked"), "ArrowUp");
      await keyOn(
        page,
        page.getByRole("button", {
          name: lang === "es" ? "Seguir" : "Next",
          exact: true,
        }),
      );
    }
    await expect(page.locator(".result")).toHaveAttribute(
      "data-outcome",
      "conditional",
    );
    await expect(page.locator(".result")).toHaveAttribute(
      "data-status",
      "Not sure yet",
    );
    await expect(page.locator(".result h2")).toHaveText(
      lang === "es"
        ? "La regla puede aplicarte. Esto es lo que cuenta."
        : "The rule may apply. Here’s what counts.",
    );
  });
}

for (const lang of ["en", "es"]) {
  test(`Coverage questions change with the Medicaid group (${lang})`, async ({
    page,
  }) => {
    const next = () =>
      page
        .getByRole("button", {
          name: lang === "es" ? "Seguir" : "Next",
          exact: true,
        })
        .click();
    const back = () =>
      page
        .getByRole("button", {
          name: lang === "es" ? "Atrás" : "Back",
          exact: true,
        })
        .click();
    await page.goto(`/check?lang=${lang}`);
    await next();
    await expect(page.locator('input[name="group"]')).toHaveCount(4);
    await page.locator('input[name="group"][value="expansion"]').check();
    await next();
    await expect(page.locator('input[name="otherGroup"]')).toHaveCount(3);
    await expect(page.locator('input[name="otherwiseEligible"]')).toHaveCount(
      0,
    );
    await page.locator('input[name="otherGroup"]').first().check();
    await back();
    await page.locator('input[name="group"][value="1115"]').check();
    await next();
    await expect(page.locator('input[name="otherwiseEligible"]')).toHaveCount(
      3,
    );
    await expect(page.locator('input[name="otherGroup"]')).toHaveCount(0);
    await page.locator('input[name="otherwiseEligible"]').first().check();
    await next();
    await expect(page.locator('input[name="fullCoverage"]')).toHaveCount(3);
    await page.locator('input[name="fullCoverage"]').first().check();
    await back();
    await back();
    await page.locator('input[name="group"][value="expansion"]').check();
    await next();
    await expect(page.locator('input[name="otherGroup"]').nth(2)).toBeChecked();
    await back();
    await page.locator('input[name="group"][value="1115"]').check();
    await next();
    await expect(
      page.locator('input[name="otherwiseEligible"]').nth(2),
    ).toBeChecked();
    await next();
    await expect(
      page.locator('input[name="fullCoverage"]').nth(2),
    ).toBeChecked();
    await back();
    await back();
    await page.locator('input[name="group"][value="other"]').check();
    await next();
    await expect(page.locator("#age")).toBeVisible();
  });
}
