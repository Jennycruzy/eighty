const citation = '42 CFR 435.558(a)(2), (c)(4)';
const dayLength = 86_400_000;

function readDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * dayLength).toISOString().slice(0, 10);
}

// Dates have no time zone. A later arrival never removes the earlier reminder.
export function noticeDeadline(printedDate, reportedArrival = null) {
  const printed = readDate(printedDate);
  const arrival = reportedArrival === null ? null : readDate(reportedArrival);
  const missing = [];
  if (!printed) missing.push('printedDate');
  if (reportedArrival !== null && !arrival) missing.push('reportedArrival');
  if (printed && arrival && arrival < printed) missing.push('reportedArrival');
  if (missing.length) {
    return {
      status: 'Not sure yet',
      basis: 'Check the dates on the letter and when it came.',
      citation,
      math: null,
      missing,
      countedAsReceived: null,
      deadline: null,
      possibleLaterDeadline: null,
      reminderDeadline: null,
      laterArrivalNeedsProof: false,
    };
  }

  const countedAsReceived = addDays(printed, 5);
  const deadline = addDays(readDate(countedAsReceived), 30);
  const late = arrival !== null && reportedArrival > countedAsReceived;
  const possibleLaterDeadline = late ? addDays(arrival, 30) : null;
  return {
    status: 'Not sure yet',
    basis: late
      ? 'The letter came late. Keep proof. Use the earlier date until the state agrees.'
      : 'The rule adds 5 days to the letter date, then 30 days to reply.',
    citation,
    math: { printedDate, receiptDays: 5, responseDays: 30 },
    missing: late ? ['proofOfLaterArrival'] : [],
    countedAsReceived,
    deadline,
    possibleLaterDeadline,
    reminderDeadline: deadline,
    laterArrivalNeedsProof: late,
  };
}
