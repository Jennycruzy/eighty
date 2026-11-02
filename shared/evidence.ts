import { z } from "zod";

import { units } from "../server/rules/common.ts";
import { HOUR_SCALE } from "../server/rules/constants.ts";
import { validDate } from "../server/rules/dates.ts";

const optionalFlag = z.boolean().nullable().optional();
const money = z.number().int().safe().nullable().optional();
const hours = z
  .number()
  .refine(
    (value) => units(value, HOUR_SCALE) !== null,
    "Use a non-negative number with at most six decimal places.",
  )
  .nullable()
  .optional();
const date = z
  .string()
  .refine(validDate, "Use a valid calendar date.")
  .nullable()
  .optional();
// A reader can suggest facts. It cannot supply an owner, a version or a confirmed status.
export const evidenceFields = z
  .strictObject({
    kind: z.enum(["work", "service", "work-program", "education", "income"]),
    start: date,
    end: date,
    hours,
    organization: z.string().trim().min(1).max(160).nullable().optional(),
    income: z
      .strictObject({
        kind: z.enum(["wages", "self-employment", "unknown"]),
        receivedOn: date,
        grossPayCents: money,
        preTaxDeductionsCents: money,
        netEarningsCents: money,
        costsConfirmed: optionalFlag,
      })
      .nullable()
      .optional(),
    service: z
      .strictObject({
        unpaid: optionalFlag,
        directCommunityBenefit: optionalFlag,
        publicOrNonprofit: optionalFlag,
        structuredAndSupervised: optionalFlag,
        nonpartisan: optionalFlag,
        tracksDatesAndHours: optionalFlag,
        confirmationContact: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .nullable()
          .optional(),
      })
      .nullable()
      .optional(),
    program: z
      .strictObject({
        approvedType: z
          .enum([
            "wioa",
            "trade-act",
            "state-approved",
            "veterans",
            "snap-partnership",
            "job-search",
          ])
          .nullable()
          .optional(),
        subsidiaryJobSearchFraction: z
          .number()
          .min(0)
          .max(1)
          .nullable()
          .optional(),
      })
      .nullable()
      .optional(),
    education: z
      .strictObject({
        enrollment: z
          .enum(["less-than-half", "half-time", "full-time"])
          .nullable()
          .optional(),
        qualifyingProgram: optionalFlag,
        termStart: date,
        termEnd: date,
        registeredForNextRegularTerm: optionalFlag,
        nextRegularTermStart: date,
        normalBreak: optionalFlag,
        exitDate: date,
        continuesInAnotherProgram: optionalFlag,
        credits: hours,
        usesCreditHours: optionalFlag,
        actualHours: hours,
      })
      .nullable()
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.start && value.end && value.end < value.start)
      context.addIssue({
        code: "custom",
        path: ["end"],
        message: "The end date must not be before the start date.",
      });
  });
export type EvidenceFields = z.infer<typeof evidenceFields>;
export const readerProposal = z.strictObject({
  fields: evidenceFields.superRefine((value, context) => {
    if (value.income?.costsConfirmed === true)
      context.addIssue({
        code: "custom",
        path: ["income", "costsConfirmed"],
        message: "Only the member can confirm business costs.",
      });
  }),
  confidence: z.number().min(0).max(1),
  questions: z
    .array(
      z.enum([
        "start",
        "end",
        "hours",
        "gross-pay",
        "pay-date",
        "pre-tax-deductions",
        "net-earnings",
        "business-costs",
        "organization",
        "school-status",
        "school-credits",
        "service-contact",
      ]),
    )
    .max(12),
});
export const readerResult = z.strictObject({
  usDocument: z.boolean(),
  proposals: z.array(readerProposal).max(60),
});
export type ReaderResult = z.infer<typeof readerResult>;
