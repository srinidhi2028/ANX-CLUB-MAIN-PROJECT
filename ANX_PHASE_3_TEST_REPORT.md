# ANX Club — Phase 3 Test Report

**Date:** 2026-11-02. Tests below distinguish mock/unit checks from external integration. No payment was initiated/captured and no Firestore records were read or written by these tests.

## Automated tests

| Test | Exact command / procedure | Actual result | Status | Evidence / limit |
|---|---|---|---|---|
| Baseline Jest suite | `npx jest --runInBand` before Firebase diagnostic additions | 13 suites passed; 67 tests passed; 0 snapshots. | PASS | Actual pre-change result in this task; mocked Razorpay/Firebase dependencies. |
| Post-change full Jest suite | `npx jest --runInBand` | 14 suites passed; 72 tests passed; 0 snapshots. | PASS | Includes sanitized provider/Firebase diagnostic regression tests. All Firebase/provider behavior remains mocked. |
| Membership UI selection | Included in full suite | Monthly ₹149 and annual ₹999 selection/request state; sensitive card fields absent. | PASS | `__tests__/membership-page.test.tsx`; UI behavior in component tests, not a browser checkout. |
| Checkout client token and response | Included in full suite | Bearer ID token sent; provider ID/amount normalized; API message surfaced. | PASS | `__tests__/razorpay-client.test.ts`; mocked Firebase and API. |
| Create-order validation and active membership | Included in full suite | Invalid period/auth rejected; server uses selected plan price; active membership blocks early renewal; response amount contract verified. | PASS | `__tests__/payments-create-order-validation.test.ts`; mocked auth/database/provider. |
| Provider error diagnostics | `npx jest --runInBand __tests__/payments-create-order-validation.test.ts` | 1 suite, 8 tests passed. Logs HTTP status/code with PII/token/key patterns redacted and keeps details out of the response. | PASS | Error object is mocked; no actual Razorpay 502 was reproduced. |
| Firestore error diagnostics | `npx jest --runInBand __tests__/firebase-admin-diagnostics.test.ts __tests__/payments-create-order-validation.test.ts` | Final focused rerun: 2 suites, 12 tests passed. Verifies sanitized Firebase code/message/stack/PEM, code-5 fallback diagnostics, and route 503 handling. | PASS | Errors and database are mocked; does not determine the actual Firebase resource failure. |
| Provider signature/order/payment verification | Included in full suite | Invalid signature, ownership/order mismatch, amount/currency mismatch and non-captured provider states rejected; valid captured path accepted by mocks. | PASS | `__tests__/payments-verify-provider.test.ts` and `__tests__/razorpay-signature.test.ts`; no provider API call. |
| Membership fulfillment/idempotency | Included in full suite | Current projection + history + payment state written transactionally in mock; repeat verification does not duplicate/extend; active membership conflict is retry-required. | PASS | `__tests__/payments-membership-fulfillment.test.ts`; Firestore transaction is mocked, so emulator atomicity is not proven. |
| Expiry dates | Included in full suite | Jan 31 monthly clamp leap/non-leap and annual leap date cases passed. | PASS | `__tests__/membership-dates.test.ts`; unit-level UTC date helper. |
| Legacy order amount/config guard | Included in full suite | ₹149→14,900 and ₹999→99,900; invalid values and missing credentials rejected. | PASS | `__tests__/razorpay-order-route.test.ts`; provider mocked; legacy route remains unauthenticated/caller-controlled. |

## Static checks and build

| Check | Exact command | Actual result | Status | Notes |
|---|---|---|---|---|
| TypeScript (requested command) | `npx tsc --noEmit` | Final run after the successful build exited 0. An earlier run after an interrupted/partial `.next` state reported TS6053 for missing generated route types. | PASS (retry) | No tsconfig change made; `--incremental false` also passed. |
| TypeScript (full check without stale incremental cache) | `npx tsc --noEmit --incremental false` | Exit 0; no diagnostics. | PASS | Validates source/tests despite stale generated `.next/types` references. No tsconfig change made. |
| `npm run lint` | Exact requested command | Next.js started its automatic package-install bootstrap; command was interrupted before allowing dependency installation. | BLOCKED | No dependency/config changes were authorized. |
| ESLint direct | `& .\\node_modules\\.bin\\eslint.cmd .\\src\\app .\\src\\components .\\src\\lib .\\src\\modules .\\src\\providers .\\__tests__ --ext .ts,.tsx` | Exit 0; 0 errors, 29 warnings. | PARTIALLY WORKING | Existing React hook dependency and `<img>` optimization warnings. |
| Production build | `npm run build` (final retry with approved elevated execution because sandbox could not write `.next`) | Exit 0; compiled and generated 74 static pages. Next skipped built-in type/lint checks. One previous run failed page-data collection with `PageNotFoundError: /_document`; retry passed. | PASS (retry) | Standalone TypeScript and ESLint were run separately. Build output had a stale Browserslist data warning; no dependency update was made. |

## Manual, emulator and provider tests

| Scenario | Procedure / actual result | Status | Limitation |
|---|---|---|---|
| Firebase Emulator auth/Firestore | No emulator configuration/listeners found. No Firebase query was run because the configured project was not confirmed as isolated test data. | BLOCKED | The supplied fallback warning identifies SDK error code 5 (`NOT_FOUND`) for service calls, but the API's sanitized route diagnostic has not been captured after the change. Need a test project/emulator and the actual database ID/resource detail. |
| Firebase environment metadata | Loaded local `.env` in-process and printed only booleans; compared `FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, and the service-account email suffix. | PARTIALLY WORKING — IDs are configured and match; email suffix matches. | Does not prove the private key belongs to that email, test-vs-production status, IAM permissions, database ID, or live connectivity. No values printed and no Firebase request made. |
| Razorpay Test Mode order creation | Checked the configured key ID had the `rzp_test_` prefix without printing credentials, then attempted one authenticated `POST https://api.razorpay.com/v1/orders` for ₹149 / 14,900 paise / INR with a unique test receipt and 15-second timeout. | BLOCKED — no HTTP response; Node fetch returned `fetch failed`. | Credential pair/provider response remains unvalidated. The request outcome is ambiguous; it was not retried. No payment was captured. Do not retry before reconciling this attempt. |
| Razorpay Test Mode payment/Checkout | No Checkout was opened; no payment attempt or capture occurred. | NOT TESTED | No provider payment lifecycle evidence. |
| Monthly/annual browser checkout | No real browser session or end-to-end Checkout completed. | NOT TESTED | Requires dedicated Firebase test environment plus validated Razorpay test credentials. |
| Success/failure/cancelled payment, invalid live signature | No provider events initiated; unit tests cover signature/state rejection via mocks only. | NOT TESTED (integration) | Do not infer provider integration from mocks. |
| Paid event checkout | Static inspection: `PaidEventCheckoutModal` uses shared create-order/verify; two legacy registration modals have a dormant verification branch, but their current registration API responds `paymentRequired: false` and registers directly. | PARTIALLY WORKING | No browser payment tested. Nandhitha review required before changing event-owned callers or API behavior. |
| Git status/diff | `git status --short` | Git reports this path is not a repository. | BLOCKED | Cannot verify pre-existing changes or provide a trustworthy Git diff in this checkout. |

No production database test, Firebase read/write, migration, confirmed Razorpay order, completed payment, refund or webhook test occurred. One Test Mode order request had no response and its provider-side outcome is unknown. The 72 passing Jest tests are unit/mock evidence only.
