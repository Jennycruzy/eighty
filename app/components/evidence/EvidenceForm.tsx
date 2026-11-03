import { useState } from "react";

import { evidenceFields, type EvidenceFields } from "../../../shared/evidence";
import { fieldsFor, getField, kinds } from "./fields";
export function EvidenceForm({
  initial,
  es,
  busy,
  onSave,
  onCancel,
}: {
  initial?: EvidenceFields | undefined;
  es: boolean;
  busy: boolean;
  onSave: (fields: EvidenceFields) => Promise<void>;
  onCancel?: () => void;
}) {
  const [kind, setKind] = useState(initial?.kind || "work"),
    [invalid, setInvalid] = useState(false);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const fields: Record<string, unknown> = { kind };
        for (const field of fieldsFor(kind)) {
          const value = String(data.get(field.path) || "").trim();
          if (!value) continue;
          let parsed: unknown = value;
          if (field.type === "money") {
            if (!/^-?\d+(\.\d{1,2})?$/.test(value)) {
              setInvalid(true);
              return;
            }
            const [whole, decimal = ""] = value.replace("-", "").split(".");
            parsed =
              (Number(whole) * 100 + Number(decimal.padEnd(2, "0"))) *
              (value.startsWith("-") ? -1 : 1);
          } else if (field.type === "number") parsed = Number(value);
          else if (field.type === "flag") parsed = value === "true";
          const keys = field.path.split(".");
          if (keys.length === 1) fields[keys[0]!] = parsed;
          else {
            const group = (fields[keys[0]!] as Record<string, unknown>) || {};
            group[keys[1]!] = parsed;
            fields[keys[0]!] = group;
          }
        }
        // A pay type is unknown until the person chooses one.
        if (fields.income && !(fields.income as Record<string, unknown>).kind)
          (fields.income as Record<string, unknown>).kind = "unknown";
        const result = evidenceFields.safeParse(fields);
        if (!result.success) {
          setInvalid(true);
          return;
        }
        setInvalid(false);
        await onSave(result.data);
      }}
    >
      <p>
        {es
          ? "Copia los datos de tu prueba. Deja en blanco lo que no sabes. Guardar no confirma la línea."
          : "Type what your proof says. Leave blanks for facts you do not know. Saving does not confirm the line."}
      </p>
      <label>
        {es ? "Tipo de prueba" : "Type of proof"}
        <select
          value={kind}
          aria-label={es ? "Tipo de prueba" : "Type of proof"}
          onChange={(event) =>
            setKind(event.target.value as EvidenceFields["kind"])
          }
        >
          {kinds.map(([value, en, spa]) => (
            <option key={value} value={value}>
              {es ? spa : en}
            </option>
          ))}
        </select>
      </label>
      {fieldsFor(kind).map((field) => {
        const value = getField(initial, field.path),
          defaults =
            value == null
              ? ""
              : field.type === "money"
                ? (Number(value) / 100).toFixed(2)
                : String(value);
        return (
          <label key={`${kind}-${field.path}`}>
            {es ? field.es : field.en}
            {field.type === "flag" || field.options ? (
              <select
                name={field.path}
                defaultValue={defaults}
                aria-label={es ? field.es : field.en}
              >
                <option value="">
                  {es ? "No estoy seguro" : "I'm not sure"}
                </option>
                {field.type === "flag" ? (
                  <>
                    <option value="true">{es ? "Sí" : "Yes"}</option>
                    <option value="false">No</option>
                  </>
                ) : (
                  field.options?.map(([key, en, spa]) => (
                    <option key={key} value={key}>
                      {es ? spa : en}
                    </option>
                  ))
                )}
              </select>
            ) : (
              <input
                name={field.path}
                type={
                  field.type === "date"
                    ? "date"
                    : field.type === "number" || field.type === "money"
                      ? "number"
                      : "text"
                }
                step={field.type === "money" ? ".01" : "any"}
                defaultValue={defaults}
                maxLength={200}
              />
            )}
          </label>
        );
      })}
      {(kind === "work" || kind === "income") && (
        <p>
          {es
            ? "Pago que nos mostraste; el estado puede contar otra cantidad. Para salarios, restamos las deducciones antes de impuestos. Para tu negocio, confirma el pago neto después de gastos."
            : "Pay you showed us; the state may count a different amount. For wages, we subtract pre-tax deductions. For your business, check net pay after costs."}
        </p>
      )}
      {invalid && (
        <p role="alert">
          {es
            ? "Revisa las fechas y los números. Usa hasta dos decimales para dólares. La fecha de fin debe ser igual o posterior al inicio."
            : "Check the dates and numbers. Use up to two decimal places for dollars. The end date must be on or after the start."}
        </p>
      )}
      <div className="actions">
        <button disabled={busy}>
          {busy
            ? es
              ? "Guardando…"
              : "Saving…"
            : es
              ? "Guardar para revisar"
              : "Save for review"}
        </button>
        {onCancel && (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onCancel}
          >
            {es ? "Cancelar" : "Cancel"}
          </button>
        )}
      </div>
    </form>
  );
}
