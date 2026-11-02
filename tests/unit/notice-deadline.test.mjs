import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// This rule uses JavaScript syntax valid in TypeScript, with no build step.
const source = await readFile(new URL('../../server/rules/notice-deadline.ts', import.meta.url), 'utf8');
const { noticeDeadline } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

const cases = [
  ['2026-01-01', '2026-01-06', '2026-02-05'],
  ['2026-01-31', '2026-02-05', '2026-03-07'],
  ['2028-02-25', '2028-03-01', '2028-03-31'],
  ['2028-02-24', '2028-02-29', '2028-03-30'],
  ['2026-12-20', '2026-12-25', '2027-01-24'],
  ['2026-03-01', '2026-03-06', '2026-04-05'],
  ['2026-10-30', '2026-11-04', '2026-12-04'],
];

for (const [printed, received, deadline] of cases) {
  test(`435.558(a)(2), (c)(4): ${printed} gives ${deadline}`, () => {
    const result = noticeDeadline(printed);
    assert.equal(result.countedAsReceived, received);
    assert.equal(result.deadline, deadline);
    assert.equal(result.reminderDeadline, deadline);
    assert.equal(result.possibleLaterDeadline, null);
    assert.deepEqual(result.missing, []);
    assert.equal(result.status, 'Not sure yet');
    assert.equal(result.citation, '42 CFR 435.558(a)(2), (c)(4)');
  });
}

test('late arrival shows both dates and keeps the earlier reminder', () => {
  const result = noticeDeadline('2026-01-01', '2026-01-12');
  assert.equal(result.deadline, '2026-02-05');
  assert.equal(result.possibleLaterDeadline, '2026-02-11');
  assert.equal(result.reminderDeadline, '2026-02-05');
  assert.equal(result.laterArrivalNeedsProof, true);
  assert.deepEqual(result.missing, ['proofOfLaterArrival']);
});

test('early arrival or arrival on day five does not shorten the period', () => {
  for (const arrival of ['2026-01-01', '2026-01-03', '2026-01-06']) {
    const result = noticeDeadline('2026-01-01', arrival);
    assert.equal(result.deadline, '2026-02-05');
    assert.equal(result.possibleLaterDeadline, null);
    assert.equal(result.laterArrivalNeedsProof, false);
  }
});

test('missing, impossible and malformed dates return no deadline', () => {
  for (const printed of [null, undefined, '', '2026-02-29', '2026-04-31', '2026-13-01', '2026-1-01', '2026-01-01T00:00:00Z', 20260101]) {
    const result = noticeDeadline(printed);
    assert.equal(result.deadline, null);
    assert.deepEqual(result.missing, ['printedDate']);
  }
  for (const arrival of ['bad', '', '2026-02-30', '2025-12-31', 123]) {
    const result = noticeDeadline('2026-01-01', arrival);
    assert.equal(result.deadline, null);
    assert.deepEqual(result.missing, ['reportedArrival']);
  }
});
