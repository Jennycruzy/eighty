import { result } from "./common.ts";
import { addDays, validDate } from "./dates.ts";
import type { Flag } from "./types.ts";

const citation = "42 CFR 435.558(a)(2), (c)(4)";

export function noticeDeadline(
  printedDate: unknown,
  reportedArrival: unknown = null,
  lateArrivalProofAccepted: Flag = false,
) {
  const missing: string[] = [];
  if (!validDate(printedDate)) missing.push("printedDate");
  if (reportedArrival !== null && !validDate(reportedArrival))
    missing.push("reportedArrival");
  if (
    validDate(printedDate) &&
    validDate(reportedArrival) &&
    reportedArrival < printedDate
  )
    missing.push("reportedArrival");
  const unknown = () => ({
    ...result(
      "Not sure yet",
      "Check the dates on the letter and when it came.",
      citation,
      null,
      missing,
    ),
    countedAsReceived: null as string | null,
    deadline: null as string | null,
    possibleLaterDeadline: null as string | null,
    reminderDeadline: null as string | null,
    laterArrivalNeedsProof: false,
  });
  if (missing.length || !validDate(printedDate)) return unknown();
  const presumedReceipt = addDays(printedDate, 5);
  const earlierDeadline = addDays(printedDate, 35);
  if (presumedReceipt === null || earlierDeadline === null) {
    missing.push("printedDate");
    return unknown();
  }
  const late = validDate(reportedArrival) && reportedArrival > presumedReceipt;
  const possibleLaterDeadline = late ? addDays(reportedArrival, 30) : null;
  if (late && possibleLaterDeadline === null) {
    missing.push("reportedArrival");
    return unknown();
  }
  const accepted = late && lateArrivalProofAccepted === true;
  return {
    ...result(
      "Not sure yet",
      late
        ? "The letter came late. Keep proof. Keep the earlier reminder date."
        : "The rule adds 5 days to the letter date, then 30 days to reply.",
      citation,
      {
        printedDate,
        receiptDays: 5,
        responseDays: 30,
        presumedReceipt,
        earlierDeadline,
      },
      late && !accepted ? ["proofOfLaterArrival"] : [],
    ),
    countedAsReceived: accepted ? reportedArrival : presumedReceipt,
    deadline: accepted ? possibleLaterDeadline : earlierDeadline,
    possibleLaterDeadline,
    reminderDeadline: earlierDeadline,
    laterArrivalNeedsProof: late && !accepted,
  };
}
