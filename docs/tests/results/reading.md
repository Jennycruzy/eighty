# Document reading

The synthetic set has 51 documents: 25 practice and 26 locked. The reader's instructions were tuned only on the practice set. The locked set was then read three times, with nothing changed between runs.

## Locked set (held out)

| Locked run | Fields right       | Wrong fields | Months right | Months wrongly marked Meets |
| ---------- | ------------------ | ------------ | ------------ | --------------------------- |
| Run 1      | 265 of 274 (96.7%) | 0            | 26 of 26     | 0                           |
| Run 2      | 264 of 274 (96.4%) | 0            | 25 of 26     | 0                           |
| Run 3      | 268 of 274 (97.8%) | 0            | 26 of 26     | 0                           |
| All three  | 797 of 822 (97.0%) | 0            | 77 of 78     | 0                           |

Across 78 months there were 0 false Meets, so the exact 95% upper bound on the false-Meets rate is 3.8%. The reader never put a wrong value in a field: every field it did not read right, it left blank for the member. The one month not matched is `paystub-b-weekly-injection-en.png`, a pay stub with a hidden instruction aimed at the model. In run 2 the reader refused to read it, so the month showed "Not sure yet" instead of a result.

- [Run 1](https://github.com/Jennycruzy/eighty/blob/main/data/reading-results/locked-2026-11-09-run1.json) · [Run 2](https://github.com/Jennycruzy/eighty/blob/main/data/reading-results/locked-2026-11-09-run2.json) · [Run 3](https://github.com/Jennycruzy/eighty/blob/main/data/reading-results/locked-2026-11-09-run3.json)

## Practice set

Both practice runs read the same 25 practice documents.

| Practice run    | Fields right       | Months right | Months wrongly marked Meets | Invalid outputs |
| --------------- | ------------------ | ------------ | --------------------------- | --------------- |
| 4 November 2026 | 228 of 269 (84.8%) | 24 of 25     | 0                           | 2               |
| 5 November 2026 | 267 of 269 (99.3%) | 25 of 25     | 0                           | 0               |

The first run had two invalid outputs. The second run had none. The second run missed two fields. These practice results do not measure use with real members.

Between runs, the reader instructions changed: school enrollment facts use the allowed values; volunteer lines carry the coordinator's contact; gig pay uses net earnings after business costs. The reader uses the deployment model setting.

- [Documents](https://github.com/Jennycruzy/eighty/blob/main/tests/reading/documents)
- [Answer files](https://github.com/Jennycruzy/eighty/blob/main/tests/reading/answers)
- [Set list and file hashes](https://github.com/Jennycruzy/eighty/blob/main/tests/reading/sets.json)
- [First result file](https://github.com/Jennycruzy/eighty/blob/main/data/reading-results/practice-2026-11-04-run1.json)
- [Second result file](https://github.com/Jennycruzy/eighty/blob/main/data/reading-results/practice-2026-11-05-run1.json)
