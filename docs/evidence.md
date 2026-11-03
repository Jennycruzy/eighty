# Add and review proof

Members with a verified email can sign in at `/check/sign-in`, then use `/add` and `/review`. Account creation remains closed in production. These screens use the same actions as the other callers; each action checks the account inside the server.

A member can type work, pay, volunteer, work program or school facts. Blanks stay unknown. Saving makes a proposed line. A separate confirmation records the reviewed facts. Editing a confirmed line returns it to proposed. Rejected lines stay in the history and can be restored through editing. Every change checks the version and writes its history in the same database transaction.

A duplicate warning compares the proposed line with current confirmed lines. “These are separate” records the IDs and versions the member reviewed. Changed comparisons must be reviewed again. The HTTP action uses the framework's structured error type so the browser receives that comparison.

## Files

Uploads accept JPEG, PNG, WebP, HEIC and PDF, up to 15 MB each. Photos are limited to 40 million pixels; PDFs to 40 pages. Password-protected and unreadable files are refused. Content is checked by the decoder, rather than trusting the file name or browser type. The request body is also bounded on the server and in Caddy.

The phone makes a smaller JPEG viewing copy, with a longest side of 2,400 pixels, when its browser can decode the image. The server handles HEIC when the phone cannot. For normal-sized files, the full original crosses the connection and is kept unchanged. Oversized JPEG, PNG and WebP files follow the smaller-copy path described below. EXIF rotation is applied to the viewing copy. The member can turn a sideways photo before saving. The original's bytes remain unchanged.

Darkness and blur checks produce warnings, never evidence or a decision. The member can retake the photo or explicitly say its facts are readable. A check and a retake write no file or database row. The server repeats the check before saving. PDF pages are rendered one at a time with local PDF.js code, without running document scripts or rendering links and forms. Page controls, rotation and size controls work on a phone. The original can be downloaded through the signed-in account.

Only original bytes are stored, through the framework's encrypted private storage. The app selects its app-owned `hosted-private` bucket and registers the provider at startup; member requests do not borrow a deployment owner's generic storage credentials. The database requires an encrypted, opaque handle. Viewing copies are made in memory and are not saved. Reads check both the verified browser session and the member's ownership. Responses use `private, no-store`. No storage handle or public document URL is returned to the browser. SHA-256 detects a repeated file within that member's account. Limits are 200 files and 300 MB per member.

An unused file, or a file linked only to rejected evidence, can be deleted. Proposed or confirmed lines keep their files as proof. Storage failures leave manual entry available. No document reader or model is used in this work.

## Checks

`pnpm test` includes generated image rotation, resizing, metadata removal, dark and blurred photos, HEIC conversion, PDF page limits and malformed uploads. Fixtures contain made-up pay facts only. The HEIC fixture was encoded from `tests/fixtures/documents/pay.png` using the supplied Dockerfile and `heif-enc`.

`pnpm check:production IMAGE` creates a separate database and two verified browser accounts. It checks English and Spanish at 360 px, file inspection and retake, encrypted storage, exact original bytes, ownership, multiple PDF pages, manual evidence, confirmation, duplicate comparisons, editing, rejection and restoration. Its private-storage transport runs only in that disposable container; encryption and decryption use the real provider. `pnpm check:storage` separately checks the configured private bucket.

Remaining launch limits: there is no independent database backup, and the file encryption key exists only on this server. Registration stays closed. The model reader is separate work.

## File size and removal safeguards

Both upload actions set `maxBodyBytes` to the base64 size of a 15 MB file plus 1 KB for JSON. The framework rejects an excessive Content-Length before reading the body and stops a chunked body when it crosses the limit. Caddy also limits `/_agent-native/actions/*` to 22 MB.

A JPEG, PNG or WebP over 15 MB or 40 million pixels is made smaller on the phone before upload. The saved JPEG has a longest side of at most 4,000 pixels, with orientation applied and quality 0.9. If needed, the phone reduces the dimensions again to stay under 15 MB. The page says before saving that it will keep a smaller copy, and confirms that after saving. The full original stays on the member's phone. Normal-sized uploads remain byte-for-byte unchanged. Oversized PDF and HEIC files give steps for splitting the PDF, choosing a lower photo size or saving a JPEG; manual entry remains available.

A file can be removed when it has no evidence lines or every linked line is rejected. A proposed or confirmed line still protects it. The database transaction removes the document row and writes a member event and an encrypted storage-deletion record together. Only after commit does the app delete the stored file. Storage failure leaves the deletion record for retry, and the member sees that deletion is pending. The framework's interval job checks due records every minute, with retries backing off to at most one hour. The record is removed only when storage confirms deletion; a failed acknowledgment is safe to retry too.

## Decoding memory

A large photo can need about 160 MB of memory to decode, so the server reads at most two documents at a time. Other uploads and file views wait up to 30 seconds for a free slot, then get a clear message to try again in a minute.
