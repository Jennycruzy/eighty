import { z } from "zod";

import states from "../data/states.json" with { type: "json" };
const answer = z.enum(["yes", "no", "unknown"]).optional();
export const screenerAnswers = z.strictObject({
  state: z
    .string()
    .refine(
      (value) => value === "" || states.some((state) => state.code === value),
      "Choose a state from the list.",
    )
    .optional(),
  group: z.enum(["", "expansion", "1115", "other"]).optional(),
  age: z
    .string()
    .refine(
      (value) =>
        value === "" || (/^\d{1,3}$/.test(value) && Number(value) <= 120),
      "Check your age.",
    )
    .optional(),
  pregnant: answer,
  medicare: answer,
  child: answer,
  care: answer,
  indian: answer,
  veteran: answer,
  treatment: answer,
  snap: answer,
  foster: answer,
  health: answer,
  tanf: answer,
});
export const memberProfile = z.strictObject({
  screener: screenerAnswers,
  language: z.enum(["en-US", "es-US"]),
});
export type MemberProfile = z.infer<typeof memberProfile>;
