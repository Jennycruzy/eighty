import type { RuleResult } from "../server/rules/types.ts";
import { screenAnswers, type ScreenerAnswers } from "./screener.ts";
export function screenerResult(answers: ScreenerAnswers) {
  return presentScreenerResult(answers, screenAnswers(answers));
}
export function presentScreenerResult(
  answers: ScreenerAnswers,
  rule: RuleResult,
) {
  let reason = "unknown";
  if (rule.status === "Exempt") {
    const match = rule.citation.match(/435\.554\(c\)\((\d+)\)/);
    reason = match
      ? ({
          "1": "foster",
          "2": "indian",
          "3": "child",
          "4": "veteran",
          "5": "health",
          "6": "tanf",
          "7": "snap",
          "8": "treatment",
          "10": "pregnant",
        }[match[1]!] ?? "unknown")
      : rule.math === null || !rule.citation.includes("435.551")
        ? "unknown"
        : answers.group === "other"
          ? "group"
          : "age" in rule.math
            ? "age"
            : answers.medicare === "yes"
              ? "medicare"
              : "unknown";
    if (reason === "child" && answers.child !== "yes") reason = "unknown";
  } else {
    const keys = [
      "pregnant",
      "medicare",
      "child",
      "care",
      "indian",
      "veteran",
      "treatment",
      "snap",
      "foster",
      "health",
      "tanf",
    ];
    const noExclusionReported = keys.every((key) => answers[key] === "no");
    const age = Number(answers.age);
    if (
      answers.state &&
      answers.age &&
      Number.isInteger(age) &&
      age >= 19 &&
      age <= 64 &&
      noExclusionReported
    )
      reason = "conditional";
    else if (answers.care === "yes") reason = "care";
    else if (answers.health === "yes") reason = "health";
    else if (answers.snap === "yes") reason = "snap";
    else if (answers.treatment === "yes") reason = "treatment";
  }
  const outcome =
    rule.status === "Exempt" && reason !== "unknown"
      ? "excluded"
      : reason === "conditional"
        ? "conditional"
        : "unknown";
  return {
    rule,
    reason,
    outcome,
    status: outcome === "unknown" ? "Not sure yet" : rule.status,
  } as const;
}
