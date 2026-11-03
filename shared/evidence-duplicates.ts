import type { EvidenceFields } from "./evidence.ts";

function organization(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}
// This is a double-counting safeguard, not a rule about which work qualifies.
// Different pay amounts do not make two records for the same pay date distinct.
export function mightDuplicate(a: EvidenceFields, b: EvidenceFields): boolean {
  const name = organization(a.organization);
  if (!name || name !== organization(b.organization)) return false;
  if (a.income && b.income && a.income.receivedOn && b.income.receivedOn)
    return a.income.receivedOn === b.income.receivedOn;
  if (a.kind !== b.kind || !a.start || !a.end || !b.start || !b.end)
    return false;
  return a.start <= b.end && b.start <= a.end;
}
export function missingDuplicateKeys(fields: EvidenceFields): string[] {
  const missing: string[] = [];
  if (!organization(fields.organization)) missing.push("organization");
  if (fields.income && !fields.income.receivedOn) missing.push("pay-date");
  if (fields.kind !== "income") {
    if (!fields.start) missing.push("start");
    if (!fields.end) missing.push("end");
  }
  if (fields.kind === "income" && !fields.income) missing.push("pay-date");
  return missing;
}
