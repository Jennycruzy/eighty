# Private storage check

Checked on 2 November 2026 against the real private R2 bucket used by Eighty. Only a small synthetic text file was used. No member document was uploaded.

| Check | Result |
| --- | --- |
| File encrypted by the application before upload | Pass |
| Authenticated raw object bytes differ from the original | Pass |
| Framework private read restores the exact original | Pass |
| Anonymous read of the same object refused | Pass, HTTP 400; the signed read returned 200 |
| Direct read link refused | Pass |
| Changed opaque handle refused | Pass |
| Delete verified with an authenticated 404 | Pass |

The bucket's dashboard showed public access disabled. This check probes the S3 endpoint; it does not enumerate Cloudflare custom-domain settings.

The original core 0.222.2 behavior failed the application's encryption requirement. A small pinned dependency patch makes its existing encryption mandatory for private buckets. The automated regression uses a local HTTP transport with real framework encryption and decryption. It failed before the patch and passed afterwards. See [the framework record](../../framework-log.md#encrypting-files-in-a-private-bucket).

Run `pnpm check:storage` on the VPS to repeat the live check. It reads the private production settings, creates one new synthetic object and removes only that object. It never lists, replaces or deletes existing member objects. The result file in `.private/` contains booleans and status codes, without credentials, file contents or object handles.

These results do not establish complete member uploads, account access, document-reading accuracy or model-provider retention. Those flows remain closed while they are completed.

On 3 November, the same seven live-bucket checks also passed with the app-owned `hosted-private` provider. The deployment uses that provider for signed-in member uploads. Both providers use the same patched encryption helper. The synthetic object was deleted and the absence was checked through an authenticated request.
