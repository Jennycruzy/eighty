export type Field = {
  path: string;
  en: string;
  es: string;
  type?: "date" | "number" | "money" | "flag";
  options?: [string, string, string][];
};
export const kinds = [
  ["work", "Work", "Trabajo"],
  ["service", "Volunteer hours", "Horas de voluntariado"],
  ["work-program", "Work program", "Programa de trabajo"],
  ["education", "School", "Estudios"],
  ["income", "Pay", "Pago"],
];
export const commonFields: Field[] = [
  {
    path: "organization",
    en: "Employer, group or school",
    es: "Empleador, grupo o escuela",
  },
  { path: "start", en: "Start date", es: "Fecha de inicio", type: "date" },
  { path: "end", en: "End date", es: "Fecha de fin", type: "date" },
  {
    path: "hours",
    en: "Hours (leave blank if not known)",
    es: "Horas (deja en blanco si no sabes)",
    type: "number",
  },
];
export const payFields: Field[] = [
  {
    path: "income.kind",
    en: "Type of pay",
    es: "Tipo de pago",
    options: [
      ["wages", "Wages", "Salario"],
      ["self-employment", "Gig or own business", "Trabajo por cuenta propia"],
      ["unknown", "I'm not sure", "No estoy seguro"],
    ],
  },
  {
    path: "income.receivedOn",
    en: "Pay date",
    es: "Fecha de pago",
    type: "date",
  },
  {
    path: "income.grossPayCents",
    en: "Gross pay, in dollars",
    es: "Pago bruto, en dólares",
    type: "money",
  },
  {
    path: "income.preTaxDeductionsCents",
    en: "Pre-tax deductions, in dollars (0 if none)",
    es: "Deducciones antes de impuestos, en dólares (0 si no hay)",
    type: "money",
  },
  {
    path: "income.netEarningsCents",
    en: "Net business pay after costs, in dollars",
    es: "Pago neto del negocio después de gastos, en dólares",
    type: "money",
  },
  {
    path: "income.costsConfirmed",
    en: "Have you checked all business costs?",
    es: "¿Revisaste todos los gastos del negocio?",
    type: "flag",
  },
];
export const extraFields: Record<string, Field[]> = {
  service: [
    ...[
      ["unpaid", "Was this unpaid?", "¿Fue sin pago?"],
      [
        "directCommunityBenefit",
        "Did this help the community?",
        "¿Ayudó a la comunidad?",
      ],
      [
        "publicOrNonprofit",
        "Was the group public or nonprofit?",
        "¿Era un grupo público o sin fines de lucro?",
      ],
      [
        "structuredAndSupervised",
        "Was this planned and supervised?",
        "¿Fue planeado y supervisado?",
      ],
      [
        "nonpartisan",
        "Was this free of party politics?",
        "¿Fue sin actividad de partidos políticos?",
      ],
      [
        "tracksDatesAndHours",
        "Does the group keep dates and hours?",
        "¿El grupo guarda fechas y horas?",
      ],
    ].map(([key, en, es]) => ({
      path: `service.${key}`,
      en: en!,
      es: es!,
      type: "flag" as const,
    })),
    {
      path: "service.confirmationContact",
      en: "Name and contact of the person who can check",
      es: "Nombre y contacto de quien puede confirmar",
    },
  ],
  "work-program": [
    {
      path: "program.approvedType",
      en: "Program type",
      es: "Tipo de programa",
      options: [
        ["wioa", "WIOA", "WIOA"],
        ["trade-act", "Trade Act", "Ley de Comercio"],
        ["state-approved", "State-approved", "Aprobado por el estado"],
        ["veterans", "Veterans", "Veteranos"],
        ["snap-partnership", "SNAP partnership", "Programa asociado con SNAP"],
        [
          "job-search",
          "Job search (does not count)",
          "Buscar empleo (no cuenta)",
        ],
      ],
    },
    {
      path: "program.subsidiaryJobSearchFraction",
      en: "Share spent on job search (0 to 1)",
      es: "Parte dedicada a buscar empleo (0 a 1)",
      type: "number",
    },
  ],
  education: [
    {
      path: "education.enrollment",
      en: "School time",
      es: "Tiempo de estudios",
      options: [
        ["less-than-half", "Less than half-time", "Menos de medio tiempo"],
        ["half-time", "Half-time", "Medio tiempo"],
        ["full-time", "Full-time", "Tiempo completo"],
      ],
    },
    ...[
      [
        "qualifyingProgram",
        "Is the school or program eligible?",
        "¿La escuela o programa cumple los requisitos?",
      ],
      [
        "usesCreditHours",
        "Does the program use credits?",
        "¿El programa usa créditos?",
      ],
      [
        "registeredForNextRegularTerm",
        "Are you signed up for the next term?",
        "¿Estás inscrito para el próximo período?",
      ],
      [
        "normalBreak",
        "Is this a normal school break?",
        "¿Es un descanso escolar normal?",
      ],
      [
        "continuesInAnotherProgram",
        "Will you go on to another program?",
        "¿Seguirás en otro programa?",
      ],
    ].map(([key, en, es]) => ({
      path: `education.${key}`,
      en: en!,
      es: es!,
      type: "flag" as const,
    })),
    {
      path: "education.credits",
      en: "Credits",
      es: "Créditos",
      type: "number",
    },
    {
      path: "education.actualHours",
      en: "Actual class and study hours (no credits)",
      es: "Horas reales de clase y estudio (sin créditos)",
      type: "number",
    },
    ...[
      ["termStart", "Term start", "Inicio del período"],
      ["termEnd", "Term end", "Fin del período"],
      ["nextRegularTermStart", "Next term start", "Inicio del próximo período"],
      [
        "exitDate",
        "Date you left school, if any",
        "Fecha de salida de la escuela, si aplica",
      ],
    ].map(([key, en, es]) => ({
      path: `education.${key}`,
      en: en!,
      es: es!,
      type: "date" as const,
    })),
  ],
};
export function fieldsFor(kind: string) {
  return [
    ...commonFields,
    ...(kind === "work" || kind === "income"
      ? payFields
      : extraFields[kind] || []),
  ];
}
export function getField(value: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce(
      (v, key) =>
        v && typeof v === "object"
          ? (v as Record<string, unknown>)[key]
          : undefined,
      value,
    );
}
