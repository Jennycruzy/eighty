export function ResultMath({
  math,
  spanish,
}: {
  math: Record<string, unknown> | null;
  spanish: boolean;
}) {
  const nested = math?.income;
  const values =
    nested && typeof nested === "object" ? { ...math, ...nested } : math;
  const rows: [string, string, string, boolean][] = [
    ["grossPayCents", "Gross pay", "Pago bruto", true],
    [
      "preTaxDeductionsCents",
      "Pre-tax deductions",
      "Deducciones antes de impuestos",
      true,
    ],
    ["amountCents", "Pay counted", "Pago contado", true],
    ["thresholdCents", "Income needed", "Ingreso necesario", true],
    ["hours", "Hours counted", "Horas contadas", false],
    ["targetHours", "Hours needed", "Horas necesarias", false],
    ["gapHours", "Hours still needed", "Horas que faltan", false],
  ];
  const format = new Intl.NumberFormat(spanish ? "es-US" : "en-US", {
    style: "currency",
    currency: "USD",
  });
  return (
    <dl>
      {rows.flatMap(([key, en, es, money]) => {
        const value = values?.[key];
        return typeof value === "number" && Number.isFinite(value)
          ? [
              <div key={key}>
                <dt>{spanish ? es : en}</dt>
                <dd>{money ? format.format(value / 100) : value}</dd>
              </div>,
            ]
          : [];
      })}
    </dl>
  );
}
