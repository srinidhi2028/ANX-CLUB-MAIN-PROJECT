# ANX Club — Phase 3 Implementation Report

**Overall status: PARTIALLY WORKING.** Membership checkout and fulfillment have been changed and mocked/unit-tested. Real Firebase and Razorpay integration remains unverified; paid event checkout needs owner review. This is not a completion or production-readiness claim.

## Scope and decisions used

The user approved these membership-specific rules in this conversation: current projection at `memberships/{uid}`, immutable term history at `memberships/{uid}/history/{orderId}`, UTC timestamps, month-end clamping (Jan 31 to Feb 28/29), and rejecting early renewal. These approvals do not approve a complete payment schema, event policy, refunds, reporting or migration.

## Findings and root causes

- Monthly selection was not presented as a distinct plan in the membership UI; it used a single-plan toggle and a brittle width class. The request carries `billingPeriod`, and the server now accepts only `monthly`/`annual` and determines ₹149/₹999 itself.
- The original order failure’s exact cause remains unknown. Confirmed code-level contract defects were that the frontend expected an `id` and paise amount while the V1 API exposed `orderId` and a rupee `amount`; the shared client also omitted the Firebase bearer token and only surfaced one error property. They are corrected for the membership flow. A test-only Razorpay order request was attempted after checking the configured key ID has the `rzp_test_` prefix; Node `fetch` failed before an HTTP response (`fetch failed`). The request outcome is ambiguous, so it was not retried. No payment was captured and no secret was printed.
- The supplied Firestore fallback text is emitted only when SDK error code is `5`/`"5"`; the previous helper hid the message and stack. This confirms a `NOT_FOUND` class error in those fallback calls, but not which resource/database is missing. A safe local environment metadata check found Admin/client project IDs match and the service-account email has the expected project suffix; it does not validate the private key/IAM grant. `src/lib/firebase/admin.ts` calls `.firestore()` without a database ID, selecting the default database; a named-database mismatch is plausible, not confirmed. Admin credential initialization already normalizes escaped private-key newlines. The payment route's own catch hid its Firestore exception and misreported it as a Razorpay 502. It now logs sanitized Firebase code/message/stack and returns Firestore-specific 503. Exact cause of the create-order lookup still requires one fresh local log and confirmation of the intended database ID.
- The checkout form collected card data directly. Those fields were removed; Razorpay Checkout is used for payment details.

## Changed files

- `src/app/(dashboard)/membership/page.tsx` — separate monthly/annual selection, visible prices, correct request period, checkout loading/error/dismissal handling, no custom card fields, no repeat initiation while pending.
- `src/modules/module3/lib/razorpay.ts` — Firebase ID token bearer header for create/verify, robust API message parsing, normalize `id`/`orderId` and amount without double conversion.
- `src/app/api/v1/payments/create-order/route.ts` — server prices, period validation, active-member early-renewal rejection, compatible response fields (`id`, `orderId`, `amountInPaise`, legacy rupee `amount`, currency, key ID), sanitized provider failures.
- `src/app/api/v1/payments/create-order/route.ts` — added request-stage diagnostics for provider errors using only safe status/code fields and a bounded description with email, phone, token and Razorpay key patterns redacted; client response remains generic.
- `src/app/api/v1/payments/create-order/route.ts` — Firestore-stage failures now log sanitized Firebase code/message/stack and return Firestore-specific 503 instead of being mislabeled as Razorpay failures.
- `src/lib/firebase/admin.ts` — code-5 fallback warnings include sanitized code/message/limited stack frames; fallback behavior is unchanged. Firestore still selects the default database.
- `src/lib/payments/razorpay.ts` — exact positive paise validation plus provider order/payment fetch helpers.
- `src/lib/payments/membership-dates.ts` — UTC month/year calendar expiry with end-of-month clamping.
- `src/app/api/v1/payments/verify/route.ts` — signature/ownership/provider captured-payment checks, amount/currency/order matching, transactional payment + profile + current membership + deterministic history fulfillment, duplicate protection and retry-required handling.
- `src/app/api/razorpay/order/route.ts` — fail-closed credential behavior, amount validation, sanitized provider errors (legacy route is still unauthenticated and caller-controlled; not safe for production use).
- Tests: `__tests__/membership-page.test.tsx`, `__tests__/razorpay-client.test.ts`, `__tests__/payments-create-order-validation.test.ts`, `__tests__/firebase-admin-diagnostics.test.ts`, `__tests__/payments-verify-provider.test.ts`, `__tests__/payments-membership-fulfillment.test.ts`, `__tests__/membership-dates.test.ts`, `__tests__/razorpay-order-route.test.ts`, `__tests__/razorpay-signature.test.ts`.
- Reports: `ANX_PHASE_3_IMPLEMENTATION_REPORT.md`, `ANX_PHASE_3_TEST_REPORT.md`, `ANX_PHASE_3_SCHEMA_DOCUMENTATION.md`, `ANX_PHASE_3_MIGRATION_AND_ROLLBACK_PLAN.md`, `ANX_PHASE_3_PENDING_DECISIONS.md`.

The project directory does not contain readable Git metadata (`git status` reports that it is not a repository), so Git cannot independently confirm the before/after file set or detect pre-existing changes. This list reflects the files changed in this work as known from the task history.

## Task status

| Area | Status | Result / remaining issue |
|---|---|---|
| Monthly and annual UI and server pricing | PASS (mocked/unit-tested) | UI submits selected plan; server sets ₹149/₹999. Browser-to-provider flow not tested. |
| Checkout response and bearer token | PASS (mocked/unit-tested) | Client/server response normalized; current Firebase user token attached. |
| Legacy order safety | PARTIALLY WORKING | Amount/config guards; identity and purpose still client-controlled and endpoint unauthenticated. |
| Signature and provider verification | PARTIALLY WORKING | HMAC, provider order/payment checks, captured status and amount/currency enforced in mocked route tests. Live provider not tested. |
| Membership fulfillment/history | PARTIALLY WORKING | Transactional current projection plus deterministic history; mocks only, no emulator validation. |
| Renewal and expiry | PASS (unit-tested) | Approved early renewal rejection and UTC calendar expiry/month-end clamp. |
| Paid event integration | PARTIALLY WORKING | `PaidEventCheckoutModal` uses the shared create-order/verify flow. Two legacy registration modals contain a payment verification branch, while their current registration API responds `paymentRequired: false` and creates registration directly. Nandhitha review is needed before changing event-owned files. |
| Student Head external-only event registration | NOT TESTED | No event files/policy changed. |
| Payment history, admin reporting, webhooks, refunds/disputes | NOT IMPLEMENTED / OUT OF SCOPE pending approval | No implementation or provider testing. |
| Firebase/Razorpay end-to-end | NOT TESTED | No emulator available; no Firebase production/test query or payment performed. One Test Mode order request returned no HTTP response. |
| Safe diagnostics for create-order 502 | PASS (mocked) | Provider HTTP status/code and sanitized description are logged in the provider stage; response does not expose the details. The actual order attempt received no HTTP response, so the 502 cause remains unknown. |
| Firestore failure diagnostics | PASS (mocked) | Error code/message/limited sanitized stack frames are logged, and membership lookup errors return HTTP 503. The user's supplied fallback line indicates Firestore SDK code 5 (`NOT_FOUND`); the exact resource and route exception are not yet confirmed. |

## Prioritized remaining work

1. **BLOCKED — identify actual Razorpay 502 cause:** the one Test Mode order attempt returned no HTTP response (`fetch failed`). Do not retry until the first attempt can be reconciled or its receipt confirmed absent, to avoid duplicate test orders. The credentials pair and provider response remain unvalidated.
2. **BLOCKED — confirm Firestore code-5 cause:** restart local dev and repeat the signed-in membership order call to capture sanitized code/message/stack; verify whether Console shows a named database rather than `(default)`. Do not change database selection until confirmed. The user-reported 502 is a Firestore-stage failure and is no longer mislabeled in the route response. Firebase Admin's key newline normalization is already present; service-account IAM and the database ID remain unverified.
3. **BLOCKED — canonical payment schema and paise-only storage:** requires product/finance approval and legacy compatibility/migration decisions. Current payment documents still store `amount` in rupees.
4. **BLOCKED — server order idempotency:** request-key and retry/conflict semantics need approval before adding behavior or persisted fields.
5. **BLOCKED — secure/deprecate root legacy endpoints:** no in-repository callers found, but external callers are unknown; coordinate with Sandharsh/auth owner and any external client owner before changing the contract.
6. **BLOCKED — event integration:** obtain Nandhitha review for paid Company Admin and external-only Student Head flows; current legacy registration path can mark a priced registration paid without payment verification.
7. **NOT IMPLEMENTED / approval pending — payment history, bounded admin reports, webhooks/reconciliation and refunds/disputes.**
8. **NOT TESTED — Firebase Emulator/isolated project and Razorpay Test Mode success/failure/cancel, duplicate and partial-failure integration cases.**

## Safety and completion

No Firestore document, migration, Firebase rule/index, dependency, package manifest, environment configuration or secret was intentionally changed. No Firestore production query was made; no payment was captured. One Test Mode order request received no HTTP response and its provider-side outcome is unknown. Build generated `.next` artifacts. Firebase and provider diagnostic changes are mocked; actual infrastructure causes remain unconfirmed. Legacy/event risks remain. Do not report Phase 3 complete until the listed items are resolved with approvals and evidence.
