# ANX Club — Phase 2 Authentication and Payment Test Report

**Purpose:** record the authentication-related automated test evidence available during Phase 2 completion verification. This report distinguishes mocked unit/API tests from live integration testing. It does not claim that Firebase or Razorpay was contacted.

**Environment:** local project checkout at `ANX-CLUB-main`; dependencies were already present in `node_modules`. No live account, payment, database, or production credentials were used. Test fixtures use mocked tokens and mocked Firebase/provider dependencies.

## Summary

- Focused automated authentication/security suite: **PASS**, 5 suites and 23 tests.
- First Jest attempt inside the sandbox: **BLOCKED** before test discovery by Windows temp-directory `EPERM`; no individual test ran during that attempt.
- Manual HTTP tests against a running app, live Firebase tests, Firestore data tests, and Razorpay provider tests: **NOT TESTED** in this verification.
- Static inspection confirms a payment auth test file and payment verification ownership test file exist. Test assertions use mocks; they do not prove live Firebase token behavior.

## Automated tests

### Focused authentication and payment security suites — PASS

**Exact command, run from the project root in PowerShell:**

```powershell
npm test -- --runInBand __tests__/payments-auth.test.ts __tests__/payments-verify-ownership.test.ts __tests__/razorpay-signature.test.ts __tests__/admin-auth.test.ts __tests__/api/admin-users.test.ts
```

**Actual result:**

```text
Test Suites: 5 passed, 5 total
Tests:       23 passed, 23 total
Snapshots:   0 total
```

**Test files and purpose:**

| Test file | Purpose and covered assertions | Result |
|---|---|---|
| `__tests__/payments-auth.test.ts` | `authenticatePaymentRequest` returns UID from mocked Firebase-verified bearer and session-cookie tokens; rejects missing, fake/invalid, expired, and UID-less token claims. | **PASS** (9 test cases, including 4 parameterized invalid-token values). |
| `__tests__/payments-verify-ownership.test.ts` | Payment verification does not expose or fulfill another user's order under mocked request/database behavior. | **PASS** (1 test). |
| `__tests__/razorpay-signature.test.ts` | HMAC signature helper accepts matching signatures and rejects tampered/mismatched inputs and wrong secret. | **PASS** (4 tests). |
| `__tests__/admin-auth.test.ts` | Admin token helper behavior for missing/malformed token, verified claims, role lookup fallback and lookup failure. | **PASS** (5 tests). |
| `__tests__/api/admin-users.test.ts` | Admin users API denies unverified/non-admin users, returns user list for admin, and handles database error. | **PASS** (4 tests). |

**Limitations:** Firebase Admin is mocked in the payment-auth test; the “valid”, “fake”, and “expired” token strings are fixtures, not genuine live Firebase tokens. Signature tests exercise local HMAC logic with test values, not a Razorpay API. The ownership test is mocked; it is not a Firestore emulator or deployed database test.

### Sandboxed Jest attempt — BLOCKED, then rerun passed

The same command was first run in the restricted sandbox. Jest exited before discovering tests with:

```text
Error: EPERM: operation not permitted, realpath '...\AppData\Local\Packages\sandbox...\Temp'
```

That attempt is **BLOCKED**, not a failing test result. With approval to run the exact same local command outside the sandbox, Jest completed and all 23 tests passed as shown above. No test code was changed.

## Manual HTTP and browser tests

| Test | Procedure/command and intended result | Actual result/status | Limitation |
|---|---|---|---|
| Valid Firebase token on V1 payment endpoint | Requires a locally running app and a genuine Firebase ID token; the earlier Phase 1 test instructions used `POST /api/v1/payments/create-order` expecting `400` when payment type is missing. | **NOT TESTED** in this verification. | No request was issued here; mocked unit tests do not establish the HTTP status from the running app. Do not use a real payment to exercise this case. |
| Missing token | POST to a protected V1 payment route without `Authorization` or session cookie; expected `401`. | **NOT TESTED** manually. | Corresponding auth helper unit case passed, but route-level HTTP behavior was not independently exercised. |
| Fake token | POST with a non-Firebase bearer token; expected `401`. | **NOT TESTED** manually. | Mocked invalid-token helper case passed; no live Firebase Admin verification occurred. |
| Expired token | POST with a genuinely expired Firebase token; expected `401`. | **NOT TESTED** manually. | Mocked expired-token helper case passed; no genuine expired token was generated or sent. |
| Cross-student order access | Verify with Student A's authenticated UID while referencing Student B's order; expected denial/no fulfillment. | **PARTIALLY WORKING** evidence: mocked ownership test passed; **NOT TESTED** against a local Firestore emulator or actual local test accounts. | No Student A/B database fixtures were created or read. |
| Student access to Admin-only API | Call an admin endpoint with a student token; expected `403`. | **PARTIALLY WORKING** evidence: mocked admin API tests passed; **NOT TESTED** manually with a running app/account. | No live Firebase role claims or local account were used. |

No browser-console token extraction was attempted in this verification.

## Static checks and code inspection

| Check | Procedure | Result |
|---|---|---|
| Test inventory | Listed `__tests__` files and test declarations with `rg --files` and `rg -n`. | **PASS**: payment auth, payment verification ownership, Razorpay signature, admin auth/API suites exist. |
| Phase 1 auth artifacts | Inspected `__tests__/payments-auth.test.ts` and ran the focused suite above. | **PASS, limited**: helper tests are present and pass; this does not verify source diffs against a baseline. |
| Application/payment schema runtime | No app server, Firebase emulator, or payment flow was started. | **NOT TESTED**. Static findings are documented in `ANX_PHASE_2_PAYMENT_MEMBERSHIP_SCHEMA_AUDIT.md`. |

## Database and external-provider tests

| Area | Result | Notes |
|---|---|---|
| Firestore emulator/local test database | **NOT TESTED** | No emulator or database operation was started. |
| Production or shared Firestore | **NOT TESTED** | No production data was accessed. |
| Razorpay test mode/API or checkout | **NOT TESTED** | No order was created and no payment was initiated. |
| Razorpay webhook/refund/cancellation | **NOT IMPLEMENTED / NOT TESTED** | Static audit found no webhook or refund implementation; no provider interaction occurred. |

## Safety and scope

- No application source files, Phase 1 auth files, Firestore rules, environment/configuration files, or database records were changed by the verification actions.
- The only file created for this verification is this report. The Phase 2 audit report already exists.
- The Jest command ran only existing local tests. No real payment was initiated and no production data or live payment credentials were used.
- Git status/diff could not be obtained: `git status` and `git diff` report “not a git repository,” and no `.git` entry is present in the project directory. Therefore pre-existing uncommitted changes and a repository-wide diff cannot be independently ruled out from Git evidence.

## Overall test conclusion

Automated mocked authentication/security tests are **PASS** (23/23). End-to-end/manual HTTP tests, live Firebase verification, database tests, and Razorpay integration tests are **NOT TESTED** here. The automated results are useful evidence for helper and route logic under mocks, but they do not establish deployed or live integration behavior.

## Phase 2 remaining required checks — 2026-10-31

This section records follow-up checks requested after the initial report. Source inspection was read-only. No Firestore emulator or shared/production Firestore was accessed, and no Razorpay SDK order call was made for these checks.

| # | Test and purpose | Exact command/procedure | Actual result and status | Evidence and limitations |
|---|---|---|---|---|
| 1 | Verify V1 payment document fields/types against the audit. | Read `src/app/api/v1/payments/create-order/route.ts` and `src/app/api/v1/payments/verify/route.ts`; compare the object passed to Firestore `.set()`/`.update()` with section 3 of the audit. | **PARTIALLY WORKING** — writer code matches the described V1 field set: `orderId`/`userId`/`currency`/`status`/`paymentType`/`billingPeriod` are strings; `amount` is a JS number; `createdAt`/`verifiedAt` are Firestore server timestamp sentinels; `paymentId` is a string after verification. Event documents omit `paymentType` and `billingPeriod`, and instead include `eventId`/`eventTitle`. | Static source verification only; persisted Firestore field types and historical documents were not read. Event `amount` type is inherited from an unvalidated Firestore event field. Source: create-order `POST`, verify `POST`. |
| 2 | Verify membership document fields/types against the audit. | Read the membership branch of `src/app/api/v1/payments/verify/route.ts`, legacy `src/app/api/razorpay/verify/route.ts`, and `src/modules/module2/services/membershipService.ts`; compare writer objects to the reader's UID-path lookup and expected `MembershipInfo`. | **PARTIALLY WORKING** — V1 creates `memberships/{autoId}` with string IDs/UIDs/plan/status/dates/provider IDs, numeric INR `amount`, and server timestamp `createdAt`; legacy creates a random-ID record with similar identity/reference fields but `plan: "Premium"` and ISO string `createdAt`. Reader expects `memberships/{uid}` and `tier`/`status`/`expiresAt`, so the write/read shapes do not agree. | Types are inferred from code expressions, not validated against stored Firestore records. Source: verify `POST`, legacy verify `POST`, `getMembership`. |
| 3 | Check INR-to-paise conversion for ₹149 and ₹999. | In PowerShell from project root: `[math]::Round(149 * 100); [math]::Round(999 * 100)`. Also inspect `src/lib/payments/razorpay.ts:createRazorpayOrder` conversion `Math.round(amount * 100)`. | **PASS** for the two fixed amounts — output was `14900` and `99900`; helper applies the same ×100 then rounding expression. | Arithmetic/helper inspection only; no Razorpay order was created. |
| 4 | Check zero, negative, decimal, and missing amounts. | Inspect amount handling in V1 `create-order` and legacy `src/app/api/razorpay/order/route.ts`; do not call Razorpay with invalid values. | **PARTIALLY WORKING** — legacy route returns 400 for a falsy amount (including zero and missing/undefined). A negative number is truthy and is passed onward after multiplication; a decimal is rounded by `Math.round` rather than rejected. V1 membership amount comes from fixed server prices and ignores submitted `amount`; V1 event amount is read from Firestore without numeric/positive/integer validation. Validation for negative, decimal, and event amounts is **NOT IMPLEMENTED**. | Static inspection only. The invalid values were not sent to the external SDK. No live SDK outcome is claimed. Source: legacy order `POST`, V1 create-order `POST`, `createRazorpayOrder`. |
| 5 | Inspect whether repeated membership verification can create duplicate memberships. | Trace membership path in V1 verify `POST`: check for a paid-status guard, existing membership lookup, deterministic membership ID, or transaction before the `.set()`. | **NOT IMPLEMENTED** (membership idempotency) — no status guard or membership lookup is present; each accepted repeat reaches a new `memberships.doc()` and `.set()`. Profile expiry is recalculated and payment is updated again. | Static control-flow inspection. No duplicate Firestore writes were attempted. Existing `__tests__/payments-verify-ownership.test.ts` covers another user's order denial, not repeated membership fulfillment. |
| 6 | Inspect expiry/renewal calculation, including month-end. | Read V1 verify `POST` (`Date`, `setMonth`) and legacy verify `POST` (`setFullYear`). Run in PowerShell: `node -e "const d = new Date(2025, 0, 31); const before = d.toString(); d.setMonth(d.getMonth() + 1); console.log(JSON.stringify({timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,before,after:d.toString(),afterISO:d.toISOString()}))"`. | **PARTIALLY WORKING** — local check returned `Asia/Calcutta`, Jan 31 2025 → Mar 3 2025 local time (`2025-03-02T18:30:00.000Z`). Code uses that same `setMonth` operation for a monthly period; twelve-month V1 and one-year legacy logic are visible in source. Neither renewal reads or extends from an existing expiry; each calculation starts from current `new Date()`. | Date arithmetic command was executed; no membership was created/updated. The intended end-of-month policy is unspecified, so the observed rollover is documented rather than judged against an invented policy. |
| 7 | Check payment/membership status consistency. | Trace the V1 membership verification sequence and legacy transaction writes; compare payment and membership status literals in both routes. | **PARTIALLY WORKING** — V1 sets payment `paid` and creates membership `active`, but writes are separate and not atomic. Legacy writes payment `success` and membership `active` in one Firestore transaction. Names differ (`paid` vs `success`); no mapping/reconciliation is present. | Static inspection only. Does not assert provider capture or inspect persisted records. No end-to-end lifecycle test exists in the existing test files inspected. |
| 8 | Check whether partial failure can leave payment and membership inconsistent. | Trace each awaited V1 write in verify membership branch: user profile `.set()`, payment `.update()`, membership `.set()`; compare legacy transaction. No fault injection performed. | **PARTIALLY WORKING** — V1 writes are sequential, outside a transaction. A failure after profile update can leave the user premium while payment remains pending; a failure after marking payment paid can leave no membership history document. Legacy payment/profile/membership writes are grouped in one transaction, though an external transaction failure was not simulated. | Static sequence inspection; no database fault injection/emulator. |
| 9 | Check legacy payment status and amount differences. | Read `src/app/api/razorpay/order/route.ts` and `src/app/api/razorpay/verify/route.ts`; compare with V1 order/verify code. | **PARTIALLY WORKING** — legacy order accepts request-body amount, rounds ×100 for provider order, and persists no pending record. Legacy verify keys `payments` by Razorpay payment ID, trusts body amount (default 0), stores status `success` and ISO `timestamp`. V1 keys by Razorpay order ID, stores server-selected amount in INR, starts `pending`, then writes `paid` and server timestamps. | Static inspection only; no historical Firestore records were read, so actual prevalence of either shape is unknown. |
| 10 | Verify order response fields against frontend expectations. | Compare JSON returned by V1 create-order `POST` to Razorpay options in `src/app/(dashboard)/membership/page.tsx` and `src/components/events/PaidEventCheckoutModal.tsx`. | **FAIL** (static contract check) — API returns `orderId`, `amount` in INR, `currency`, `keyId`; both checkout callers use `order.id`, `order.amount`, and `order.currency`, with `order.id` also used as `order_id`. The response has no `id`, and its `amount` is not the paise `order.amount` from the provider order. | No checkout was initiated. This is a source-contract comparison, not a live Razorpay failure observation. |

### Focused automated tests run for this follow-up

**Exact command (PowerShell, project root):**

```powershell
npm test -- --runInBand __tests__/payments-auth.test.ts __tests__/payments-verify-ownership.test.ts
```

**Actual result:** `Test Suites: 2 passed, 2 total`; `Tests: 10 passed, 10 total`. The first sandboxed attempt was blocked before Jest discovery with Windows temp-directory `EPERM`; after approval, the same command completed successfully. These tests mock Firebase and database behavior. They do not test payment schema writes, repeated membership verification, partial failure, invalid amounts, expiry persistence, checkout response, Firestore, or Razorpay. Relevant test files: `__tests__/payments-auth.test.ts` and `__tests__/payments-verify-ownership.test.ts`.

### Follow-up conclusion

The fixed-price conversion and month-end arithmetic were checked locally without provider/database calls. Writer fields, statuses, failure ordering, invalid amount handling, replay behavior, and checkout contract were inspected statically. The requested record-level checks remain only partially verified because no safe local Firestore fixture/emulator for payment and membership documents was present or used. No production data was read, no payment was initiated, and no application code was changed.
