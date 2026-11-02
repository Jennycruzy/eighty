import { result } from "./common.ts";
import { validDate } from "./dates.ts";
import type { Flag } from "./types.ts";

export interface DocumentationInput {
  date: string;
  kind: "general" | "medical-frailty";
  reliableStateData?: Flag;
  reasonablyAvailable?: Flag;
  medicalStatementUsedThisEnrollment?: Flag;
  firstRenewalAfterMedicalStatement?: Flag;
}

export function documentationEra(input: DocumentationInput) {
  const citation = "42 CFR 435.557(b)(2)";
  const finish = (
    policy: string | null,
    basis: string,
    applied = citation,
    missing: string[] = [],
  ) => ({
    ...result("Not sure yet", basis, applied, { policy }, missing),
    policy,
  });
  if (!validDate(input.date))
    return finish(null, "Check the review date.", citation, [
      "documentation.date",
    ]);
  if (input.reliableStateData === true)
    return finish(
      "state-data-first",
      "The state must use reliable data before asking you for more proof.",
      "42 CFR 435.557(b), (c)(1)(i)",
    );
  if (input.reliableStateData !== false)
    return finish(
      null,
      "Check whether the state can verify this from its data.",
      citation,
      ["documentation.reliableStateData"],
    );
  if (input.kind === "medical-frailty") {
    if (input.date < "2028-01-01")
      return finish(
        "medical-statement-option-each-check",
        "The state may accept a sworn statement or require proof at each health review.",
        "42 CFR 435.557(f)(1)(i)",
      );
    if (
      input.medicalStatementUsedThisEnrollment === true ||
      input.firstRenewalAfterMedicalStatement === true
    )
      return finish(
        "medical-data-or-documentation",
        "The state must verify health status from data or documents after the one-time statement.",
        "42 CFR 435.557(f)(1)(ii)(A)–(B)",
      );
    if (
      input.medicalStatementUsedThisEnrollment !== false ||
      input.firstRenewalAfterMedicalStatement !== false
    )
      return finish(
        null,
        "Check whether a sworn statement has already been used during this enrollment.",
        "42 CFR 435.557(f)(1)(ii)",
        ["documentation.medicalStatementHistory"],
      );
    return finish(
      "medical-statement-option-once",
      "The state may accept a sworn statement once during this enrollment. A later review needs data or documents.",
      "42 CFR 435.557(f)(1)(ii)",
    );
  }
  if (input.kind !== "general")
    return finish(null, "Check which proof rule applies.", citation, [
      "documentation.kind",
    ]);
  if (input.date < "2028-01-01")
    return finish(
      "documentation-or-other-information",
      "The state may ask for documents or accept other information.",
      `${citation}(i)`,
    );
  if (input.reasonablyAvailable === true)
    return finish(
      "documentation-required",
      "The state must ask for documents when they are reasonably available.",
      `${citation}(ii)`,
    );
  if (input.reasonablyAvailable === false)
    return finish(
      "other-information-must-be-accepted",
      "The state must accept other information when documents are not reasonably available.",
      `${citation}(iii)(A)–(B)`,
    );
  return finish(
    null,
    "Check whether documents are reasonably available.",
    `${citation}(ii)–(iii)`,
    ["documentation.reasonablyAvailable"],
  );
}
