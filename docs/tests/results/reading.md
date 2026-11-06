# Document reading

The synthetic set has 51 documents: 25 practice and 26 locked. Both practice runs below read the same 25 practice documents. The locked set is kept apart for the final model runs.

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
