import assert from "node:assert/strict";
import test from "node:test";

import {
  registrationInput,
  finishRegistrationInput,
} from "../../server/lib/registration.ts";
const input = {
  email: "MEMBER@example.test",
  consent: true,
  profile: {
    language: "es-US",
    screener: { state: "NE", age: "34", child: "yes" },
  },
};
test("The carried answers requires consent, known screener fields and no password or ownership claims", () => {
  assert.equal(registrationInput.parse(input).email, "member@example.test");
  for (const extra of [
    { password: "NeverCarryPasswords" },
    { ownerEmail: "other@example.test" },
    { status: "confirmed" },
  ])
    assert.throws(() => registrationInput.parse({ ...input, ...extra }));
  assert.throws(() => registrationInput.parse({ ...input, consent: false }));
  assert.throws(() =>
    registrationInput.parse({
      ...input,
      profile: {
        ...input.profile,
        screener: { ...input.profile.screener, diagnosis: "not-collected" },
      },
    }),
  );
  assert.throws(() =>
    finishRegistrationInput.parse({ draft: "opaque", userId: "other" }),
  );
});
