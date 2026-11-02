const messages: Record<string, [string, string]> = {
  confirmation: [
    "Review the numbers and check the confirmation box.",
    "Revisa los números y marca la casilla para confirmarlos.",
  ],
  month: [
    "Choose a valid month that has started.",
    "Elige un mes válido que ya empezó.",
  ],
  hours: [
    "Enter the work hours you have already completed.",
    "Escribe las horas de trabajo que ya hiciste.",
  ],
  "income.confirmed": [
    "Review and confirm the income numbers.",
    "Revisa y confirma los ingresos.",
  ],
  "income.grossPayCents": [
    "Enter gross pay from the stub. Do not use take-home pay.",
    "Escribe el pago bruto del recibo. No uses el pago que te queda.",
  ],
  "income.preTaxDeductionsCents": [
    "Check the pre-tax deductions on the stub. Type 0 if there are none.",
    "Revisa las deducciones antes de impuestos del recibo. Escribe 0 si no hay.",
  ],
  "income.netEarningsCents": [
    "Enter your earnings after business costs.",
    "Escribe tus ganancias después de los gastos del negocio.",
  ],
  "income.costsConfirmed": [
    "Check your business costs before confirming net earnings.",
    "Revisa los gastos de tu negocio antes de confirmar las ganancias netas.",
  ],
  "income.amountCents": [
    "Pay is still unknown. Add pay details or proof of enough work hours.",
    "Aún no sabemos el pago. Añade los datos del pago o pruebas de suficientes horas.",
  ],
  "income.medicaidMagiCount": [
    "Check how this income counts for Medicaid.",
    "Revisa cómo cuenta este ingreso para Medicaid.",
  ],
};
export function MissingFacts({
  fields,
  spanish,
}: {
  fields: string[];
  spanish: boolean;
}) {
  const text = [
    ...new Set(
      fields.map(
        (field) =>
          (messages[field] || [
            "More facts need proof. Ask your state before relying on this result.",
            "Faltan pruebas de algunos datos. Pregunta al estado antes de usar este resultado.",
          ])[spanish ? 1 : 0],
      ),
    ),
  ];
  return text.length ? (
    <ul>
      {text.map((value) => (
        <li key={value}>{value}</li>
      ))}
    </ul>
  ) : null;
}
