import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

import { getDbExec } from "@agent-native/core/db";
import { expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

import { checkUploadSize } from "./check-upload-size.mjs";

export async function checkEvidenceBrowser(sessions, baseURL, choose) {
  const png = await readFile(
    new URL("../tests/fixtures/documents/pay.png", import.meta.url),
  );
  const manyPixels = await sharp(png)
    .resize(8200, 5000, { fit: "fill" })
    .jpeg()
    .toBuffer();
  const oversizedPhoto = await sharp(randomBytes(4500 * 2500 * 3), {
    raw: { width: 4500, height: 2500, channels: 3 },
  })
    .png({ compressionLevel: 0 })
    .toBuffer();
  assert(
    oversizedPhoto.length > 15 * 1024 * 1024,
    "The browser fixture must be a real image over 15 MB",
  );
  const large = await sharp(png).resize(3600, 4800).jpeg().toBuffer();
  const heic = await readFile(
    new URL("../tests/fixtures/documents/pay.heic", import.meta.url),
  );
  const pdf = await PDFDocument.create();
  for (const text of ["Synthetic first page", "Synthetic second page"]) {
    const page = pdf.addPage([400, 500]);
    page.drawText(text, { x: 30, y: 420, size: 18 });
  }
  const pdfBytes = Buffer.from(await pdf.save());
  const dark = await sharp({
    create: { width: 600, height: 800, channels: 3, background: "black" },
  })
    .png()
    .toBuffer();
  await checkUploadSize(sessions[0].context, baseURL);
  for (const session of sessions) {
    const { page, context, email } = session,
      es = email.endsWith("-es@example.test"),
      lang = es ? "es" : "en";
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseURL}/add?lang=${lang}`);
    await page
      .getByRole("heading", {
        name: es ? "Mis pruebas" : "My proof",
        exact: true,
      })
      .waitFor();
    await page
      .getByText(es ? "Aún no hay líneas." : "No proof lines yet.", {
        exact: false,
      })
      .waitFor();
    const fileInput = page.getByLabel(es ? "Elegir archivo" : "Choose a file");
    await fileInput.setInputFiles({
      name: "large.jpg",
      mimeType: "image/jpeg",
      buffer: large,
    });
    const preview = page.locator("img.photo-preview");
    await preview.waitFor();
    assert.deepEqual(
      await preview.evaluate((image) => [
        image.naturalWidth,
        image.naturalHeight,
      ]),
      [1800, 2400],
      "The phone must downscale the viewing copy",
    );
    await choose(
      page,
      page.getByRole("button", {
        name: es ? "Girar foto" : "Rotate photo",
        exact: true,
      }),
      "Enter",
    );
    await page.waitForFunction(
      () => document.querySelector("img.photo-preview")?.naturalWidth === 2400,
    );
    assert.deepEqual(
      await preview.evaluate((image) => [
        image.naturalWidth,
        image.naturalHeight,
      ]),
      [2400, 1800],
      "The member can turn a sideways photo",
    );
    async function activate(locator, key) {
      await expect(locator).toBeEnabled({ timeout: 30000 });
      await choose(page, locator, key);
    }
    async function upload(buffer, name, mimeType) {
      await expect(fileInput).toBeEnabled({ timeout: 30000 });
      await fileInput.setInputFiles({ name, mimeType, buffer });
      await activate(
        page.getByRole("button", {
          name: es ? "Revisar archivo" : "Check file",
          exact: true,
        }),
        "Enter",
      );
      const save = page.getByRole("button", {
        name: es ? "Guardar archivo privado" : "Save private file",
        exact: true,
      });
      await save.waitFor();
      return save;
    }
    let save = await upload(dark, "dark.png", "image/png");
    assert.equal(
      await save.isDisabled(),
      true,
      "A dark photo requires the member's review",
    );
    await activate(
      page.getByRole("button", {
        name: es
          ? "Tomar otra o elegir otro archivo"
          : "Retake or choose another file",
      }),
      "Enter",
    );
    let docs = await getDbExec().execute({
      sql: "SELECT id FROM eighty_documents WHERE owner_email=?",
      args: [email],
    });
    assert.equal(
      docs.rows.length,
      0,
      "Checking and retaking must not save a file",
    );
    save = await upload(png, "synthetic.png", "image/png");
    await choose(page, save, "Enter");
    const employer = page.getByLabel(
      es ? "Empleador, grupo o escuela" : "Employer, group or school",
    );
    await employer.waitFor();
    await employer.fill("Synthetic delivery company");
    await page
      .getByLabel(es ? "Fecha de inicio" : "Start date", { exact: true })
      .fill("2026-10-01");
    await page
      .getByLabel(es ? "Fecha de fin" : "End date", { exact: true })
      .fill("2026-10-31");
    await page
      .getByLabel(
        es
          ? "Horas (deja en blanco si no sabes)"
          : "Hours (leave blank if not known)",
      )
      .fill("45");
    await page
      .getByLabel(es ? "Fecha de pago" : "Pay date", { exact: true })
      .fill("2026-10-31");
    await page
      .getByLabel(es ? "Tipo de pago" : "Type of pay", { exact: true })
      .selectOption("wages");
    await page
      .getByLabel(es ? "Pago bruto, en dólares" : "Gross pay, in dollars", {
        exact: true,
      })
      .fill("650");
    await page
      .getByLabel(
        es
          ? "Deducciones antes de impuestos, en dólares (0 si no hay)"
          : "Pre-tax deductions, in dollars (0 if none)",
        { exact: true },
      )
      .fill("20");
    await choose(
      page,
      page.getByRole("button", {
        name: es ? "Guardar para revisar" : "Save for review",
        exact: true,
      }),
      "Enter",
    );
    const first = page.getByRole("article").first();
    await first
      .getByText(
        es ? "Por revisar; no cuenta" : "Needs review; does not count",
        { exact: true },
      )
      .waitFor();
    await choose(
      page,
      first.getByRole("button", {
        name: es ? "Confirmar los datos" : "Confirm facts",
        exact: true,
      }),
      "Enter",
    );
    await first
      .getByText(es ? "Datos confirmados" : "Facts confirmed", { exact: true })
      .waitFor();
    docs = await getDbExec().execute({
      sql: "SELECT id,handle FROM eighty_documents WHERE owner_email=?",
      args: [email],
    });
    assert.equal(docs.rows.length, 1);
    assert.equal(docs.rows[0].handle.encrypted, true);
    assert.equal(docs.rows[0].handle.opaque, true);
    const documentId = docs.rows[0].id;
    const ownFile = await page.evaluate(async (url) => {
      const response = await fetch(url, { cache: "no-store" });
      return {
        status: response.status,
        cacheControl: response.headers.get("cache-control"),
        body: await response.json(),
      };
    }, `${baseURL}/_agent-native/actions/get_document?id=${documentId}`);
    assert.equal(ownFile.status, 200);
    assert.match(ownFile.cacheControl || "", /no-store/);
    assert.equal(ownFile.body.original, png.toString("base64"));
    assert(!JSON.stringify(ownFile.body).includes('"handle"'));
    // Run in the other browser so the disposable hostname and its real cookie apply.
    const other = sessions.find((value) => value.email !== email);
    const denied = await other.page.evaluate(
      async (url) => (await fetch(url)).status,
      `${baseURL}/_agent-native/actions/get_document?id=${documentId}`,
    );
    assert.equal(denied, 404);
    await activate(
      page.getByRole("button", {
        name: es ? "Escribir los datos" : "Type the facts",
        exact: true,
      }),
      "Enter",
    );
    await employer.fill("Synthetic delivery company");
    await page
      .getByLabel(es ? "Fecha de inicio" : "Start date", { exact: true })
      .fill("2026-10-01");
    await page
      .getByLabel(es ? "Fecha de fin" : "End date", { exact: true })
      .fill("2026-10-31");
    await page
      .getByLabel(
        es
          ? "Horas (deja en blanco si no sabes)"
          : "Hours (leave blank if not known)",
      )
      .fill("12");
    await activate(
      page.getByRole("button", {
        name: es ? "Guardar para revisar" : "Save for review",
        exact: true,
      }),
      "Enter",
    );
    const second = page.getByRole("article").nth(1);
    await activate(
      second.getByRole("button", {
        name: es ? "Confirmar los datos" : "Confirm facts",
        exact: true,
      }),
      "Enter",
    );
    const separate = second.getByRole("button", {
      name: es ? "Estas son distintas" : "These are separate",
      exact: true,
    });
    await separate.waitFor();
    await choose(page, separate, "Enter");
    await second
      .getByText(es ? "Datos confirmados" : "Facts confirmed", { exact: true })
      .waitFor();
    const choices = await getDbExec().execute({
      sql: "SELECT duplicate_choice FROM eighty_evidence_versions WHERE owner_email=? AND duplicate_choice IS NOT NULL",
      args: [email],
    });
    assert.equal(choices.rows.length, 1);
    assert.equal(choices.rows[0].duplicate_choice.choice, "these-are-separate");
    await activate(
      first.getByRole("button", { name: es ? "Editar" : "Edit", exact: true }),
      "Enter",
    );
    await page
      .getByLabel(
        es
          ? "Horas (deja en blanco si no sabes)"
          : "Hours (leave blank if not known)",
      )
      .fill("46");
    await activate(
      page.getByRole("button", {
        name: es ? "Guardar para revisar" : "Save for review",
        exact: true,
      }),
      "Enter",
    );
    await first
      .getByText(
        es ? "Por revisar; no cuenta" : "Needs review; does not count",
        { exact: true },
      )
      .waitFor();
    await choose(
      page,
      first.getByRole("button", {
        name: es ? "Rechazar" : "Reject",
        exact: true,
      }),
      "Enter",
    );
    await first
      .getByText(es ? "Rechazada; no cuenta" : "Rejected; does not count", {
        exact: true,
      })
      .waitFor();
    await activate(
      first.getByRole("button", {
        name: es ? "Restaurar y editar" : "Restore and edit",
        exact: true,
      }),
      "Enter",
    );
    await activate(
      page.getByRole("button", {
        name: es ? "Guardar para revisar" : "Save for review",
        exact: true,
      }),
      "Enter",
    );
    await first
      .getByText(
        es ? "Por revisar; no cuenta" : "Needs review; does not count",
        { exact: true },
      )
      .waitFor();
    save = await upload(pdfBytes, "two-pages.pdf", "application/pdf");
    await page
      .getByText(es ? "Página 1 de 2" : "Page 1 of 2", { exact: true })
      .waitFor();
    await activate(
      page.getByRole("button", {
        name: es ? "Página siguiente" : "Next page",
        exact: true,
      }),
      "Enter",
    );
    await page
      .getByText(es ? "Página 2 de 2" : "Page 2 of 2", { exact: true })
      .waitFor();
    await activate(save, "Enter");
    await employer.waitFor();
    await activate(
      page.getByRole("button", {
        name: es ? "Cancelar" : "Cancel",
        exact: true,
      }),
      "Enter",
    );
    save = await upload(heic, "synthetic.heic", "image/heic");
    if (await save.isDisabled())
      await activate(
        page.getByLabel(
          es
            ? "Puedo leer los datos en esta foto"
            : "I can read the facts in this photo",
        ),
        "Space",
      );
    await activate(save, "Enter");
    await employer.waitFor();
    await activate(
      page.getByRole("button", {
        name: es ? "Cancelar" : "Cancel",
        exact: true,
      }),
      "Enter",
    );
    const unused = page
      .locator("section")
      .filter({
        has: page.getByRole("heading", {
          name: es ? "Mis archivos privados" : "My private files",
          exact: true,
        }),
      })
      .last();
    await activate(
      unused
        .getByRole("button", {
          name: es ? "Borrar archivo sin uso" : "Delete unused file",
          exact: true,
        })
        .last(),
      "Enter",
    );
    await page.waitForFunction(
      () =>
        !Array.from(document.querySelectorAll("button")).some(
          (b) => b.disabled && b.textContent.includes("Salir"),
        ),
    );
    save = await upload(manyPixels, "over-40-million-pixels.jpg", "image/jpeg");
    await page
      .getByText(
        es
          ? "Esta foto es muy grande. Guardaremos una copia más pequeña."
          : "This photo is too large. We will save a smaller copy.",
        { exact: true },
      )
      .waitFor();
    await activate(
      page.getByRole("button", {
        name: es
          ? "Tomar otra o elegir otro archivo"
          : "Retake or choose another file",
        exact: true,
      }),
      "Enter",
    );
    save = await upload(oversizedPhoto, "large-real-image.png", "image/png");
    await activate(save, "Enter");
    await page
      .getByText(
        es
          ? "Guardamos una copia más pequeña de tu foto."
          : "We saved a smaller copy of your photo.",
        { exact: true },
      )
      .waitFor();
    await employer.waitFor();
    await activate(
      page.getByRole("button", {
        name: es ? "Cancelar" : "Cancel",
        exact: true,
      }),
      "Enter",
    );
    const smaller = await getDbExec().execute({
      sql: "SELECT id,mime,bytes FROM eighty_documents WHERE owner_email=? ORDER BY created_at DESC LIMIT 1",
      args: [email],
    });
    assert.equal(smaller.rows[0].mime, "image/jpeg");
    assert(smaller.rows[0].bytes < 15 * 1024 * 1024);
    const savedCopy = await page.evaluate(
      async (id) =>
        (
          await (
            await fetch("/_agent-native/actions/get_document?id=" + id)
          ).json()
        ).original,
      smaller.rows[0].id,
    );
    const dimensions = await sharp(Buffer.from(savedCopy, "base64")).metadata();
    assert.equal(dimensions.width, 4000);
    assert.equal(dimensions.height, 2222);
    await activate(
      page.getByRole("button", {
        name: es ? "Escribir los datos" : "Type the facts",
        exact: true,
      }),
      "Enter",
    );
    await employer.fill("Unsaved offline facts");
    await context.setOffline(true);
    await activate(
      page.getByRole("button", {
        name: es ? "Guardar para revisar" : "Save for review",
        exact: true,
      }),
      "Enter",
    );
    await page.getByRole("alert").first().waitFor();
    assert.equal(
      await employer.inputValue(),
      "Unsaved offline facts",
      "A failed save must keep the typed facts",
    );
    await context.setOffline(false);
    await activate(
      page.getByRole("button", {
        name: es ? "Cancelar" : "Cancel",
        exact: true,
      }),
      "Enter",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "Phone must not overflow",
    );
    assert.deepEqual(
      errors,
      [],
      "No browser errors in evidence review, HEIC or multi-page PDF",
    );
    await choose(
      page,
      page.getByRole("link", {
        name: es ? "Revisar" : "Review proof",
        exact: true,
      }),
      "Enter",
    );
    await page
      .getByRole("heading", {
        name: es ? "Revisar mis pruebas" : "Review my proof",
        exact: true,
      })
      .waitFor();
    await page.getByRole("article").first().waitFor();
    await page.screenshot({
      path: `.private/evidence-${lang}.png`,
      fullPage: true,
    });
    await choose(
      page,
      page.getByRole("button", {
        name: es ? "Salir" : "Sign out",
        exact: true,
      }),
      "Enter",
    );
    await page
      .getByRole("heading", {
        name: es ? "Entrar a mi cuenta" : "Sign in to my account",
        exact: true,
      })
      .waitFor();
    await page.getByLabel(es ? "Correo" : "Email", { exact: true }).fill(email);
    await page
      .getByLabel(es ? "Contraseña" : "Password", { exact: true })
      .fill(session.password);
    await choose(
      page,
      page.getByRole("button", {
        name: es ? "Entrar" : "Sign in",
        exact: true,
      }),
      "Enter",
    );
    await page
      .getByRole("heading", {
        name: es ? "Mis pruebas" : "My proof",
        exact: true,
      })
      .waitFor();
    console.log(
      `PASS ${lang}: private PNG/HEIC/PDF, retake, original bytes, two-page view, owner check, manual entry, confirm, duplicate choice, edit, reject and restore.`,
    );
  }
}
