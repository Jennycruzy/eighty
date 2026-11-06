import type { MonthFacts } from "./month-input.ts";

export function monthExplanation(
  facts: MonthFacts,
  result: { status: string; citation: string; basis: string },
) {
  const care = facts.exclusions.care;
  if (
    result.status === "Exempt" &&
    result.citation === "42 CFR 435.554(c)(3)(i)(A)" &&
    care?.role === "family-caregiver" &&
    care.dependentAdaDisability === true &&
    care.primarilyResidesTogether === true &&
    care.regularAssistance === true &&
    care.solelyIncidental === false
  ) {
    return {
      citation: "42 CFR 435.554(c)(3)(i)(A)",
      explanation:
        "You live with a family member who has a disability and depends on your regular help. That can exclude you from the work rule. Your state decides.",
      explanationEs:
        "Vives con un familiar que tiene una discapacidad y depende de tu ayuda habitual. Eso puede excluirte de la regla de trabajo. Tu estado decide.",
    };
  }
  return { citation: result.citation };
}
