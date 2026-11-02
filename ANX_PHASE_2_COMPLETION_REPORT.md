# ANX Club — Phase 2 Completion Report

**Phase:** Payment and Membership Schema Audit  
**Date:** 2026-10-31  
**Project:** `ANX-CLUB-main`

## 1. Objective and scope

Phase 2 inspected the existing payment and membership data architecture and documented its behavior, inconsistencies, risks, and a proposed canonical schema before any implementation work. The work covered V1 and legacy payment routes, membership writes and reads, event-payment dependencies, statuses, amounts and conversions, identifiers, renewal/expiry, timestamps, authorization, duplicate processing, reporting, scalability, frontend/admin dependencies, migration risks, and teammate coordination.

The inspection was limited to repository source/configuration files. It did not inspect live Firestore data, deployed Firebase rules, production routes, Razorpay dashboards, or payment records.

## 2. Audit activities completed

The audit documented:

- V1 `payments/{orderId}` and legacy `payments/{paymentId}` shapes, their fields, types inferred from writer code, and lifecycle differences.
- V1 and legacy membership records, user-profile membership projections, and the mismatch with the UID-keyed Module 2 membership reader.
- Existing payment, membership, event-registration, and mock mentor status values and observed transitions.
- Rupee and paise values, the provider-boundary conversion, amount validation gaps, and checkout response field mismatch.
- UID, Razorpay order/payment, membership, event, and registration identifiers and their relationships.
- Membership verification replay behavior, event verification idempotency, sequential writes, and possible partial fulfillment.
- Renewal and expiry behavior, including the month-end rollover observed when using JavaScript `Date.setMonth`.
- Legacy route authorization and schema risks; missing refund, cancellation, webhook, and payment-history implementations.
- Database query, reporting, pagination, indexing, and scalability concerns.
- Student, event, profile, and admin consumers, plus teammate approval points.
- A proposed canonical payment/membership schema and migration approach. These are recommendations, not implemented behavior.

The detailed evidence and findings remain in [ANX_PHASE_2_PAYMENT_MEMBERSHIP_SCHEMA_AUDIT.md](ANX_PHASE_2_PAYMENT_MEMBERSHIP_SCHEMA_AUDIT.md).

## 3. Testing activities completed

Supplementary work combined existing automated tests, local arithmetic/date checks, and read-only source inspection. No new test files or fixtures were added.

### Automated tests

The broader focused authentication/payment security run completed with:

```text
Test Suites: 5 passed, 5 total
Tests:       23 passed, 23 total
Snapshots:   0 total
```

The later focused payment-authentication/ownership run completed with:

```text
Test Suites: 2 passed, 2 total
Tests:       10 passed, 10 total
Snapshots:   0 total
```

The 10 tests are a subset of the 23-test run and **must not be added together as 33 unique tests**. The tests use mocked Firebase/database behavior; they do not exercise live Firebase or Razorpay.

The broader command was:

```powershell
npm test -- --runInBand __tests__/payments-auth.test.ts __tests__/payments-verify-ownership.test.ts __tests__/razorpay-signature.test.ts __tests__/admin-auth.test.ts __tests__/api/admin-users.test.ts
```

The focused follow-up command was:

```powershell
npm test -- --runInBand __tests__/payments-auth.test.ts __tests__/payments-verify-ownership.test.ts
```

Jest was initially blocked before test discovery by a Windows temp-directory `EPERM` in the sandbox. After approval to run the same local command outside the sandbox, the tests passed. This was an execution-environment issue, not a failed test assertion.

### Local arithmetic and date check

PowerShell arithmetic was run:

```powershell
[math]::Round(149 * 100)
[math]::Round(999 * 100)
```

It returned `14900` and `99900`, matching the code's `Math.round(amount * 100)` conversion for these whole-rupee prices. This did not create a Razorpay order.

The local month-end calculation was run in the `Asia/Calcutta` timezone:

```powershell
node -e "const d = new Date(2025, 0, 31); const before = d.toString(); d.setMonth(d.getMonth() + 1); console.log(JSON.stringify({timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,before,after:d.toString(),afterISO:d.toISOString()}))"
```

It returned January 31, 2025 → March 3, 2025 local time (`2025-03-02T18:30:00.000Z`). This records JavaScript's observed month arithmetic; no product policy for end-of-month expiry was assumed.

### Static checks and tests not executed

Payment/membership record writers and readers, status transitions, invalid-amount handling, replay behavior, partial-write order, legacy schema, and checkout response fields were inspected statically. They were not verified against stored Firestore documents. No local app HTTP tests, Firestore emulator tests, fault-injection tests, or live-provider tests were run.

Full test inventory and individual results are recorded in [ANX_PHASE_2_TEST_REPORT.md](ANX_PHASE_2_TEST_REPORT.md).

## 4. Confirmed issues by priority

### P0

- V1 create-order returns `orderId` and a major-unit INR `amount`; membership and event checkout consumers expect `order.id` and the provider order amount. This is a confirmed response-contract mismatch.
- Root legacy Razorpay order and verification routes do not enforce Firebase ownership. Legacy verification accepts body-supplied user identity and amount.

### P1

- V1 membership verification has no idempotency guard; repeated verification can create duplicate membership documents and recalculate expiry from the current time.
- Membership writers use generated document IDs and `plan`/`endDate`, while a dashboard service reads `memberships/{uid}` and expects `tier`/`expiresAt`.
- V1 fulfillment does not fetch provider payment state or compare captured amount/currency before updating local records.
- Event payment/registration has simulated and duplicated representations that need coordination with the Events owner.
- Admin profile membership changes can diverge from payment and membership-history records.

### P2

- Current/legacy payment status and key differences include `paid` versus `success`, order ID versus payment ID, and event `Free` versus `not_required` values.
- Amount and timestamp representations differ across paths; expiry month-end and renewal policy are unresolved.
- Admin analytics performs broad collection reads; cron MRR logic does not distinguish monthly and annual plans.

### P3

- Persisted failed/cancelled/refunded lifecycle, refund handling, webhook reconciliation, and pending-order cleanup were not found.

These are code-inspection findings, not newly executed end-to-end failures, except the checkout response contract mismatch, which was confirmed by comparing the API response shape with its callers.

## 5. Test status summary

| Status | Phase 2 results |
|---|---|
| **PASS** | Existing mocked auth/security Jest suites passed: broad run 5 suites/23 tests; focused payment run 2 suites/10 tests. Rupee-to-paise arithmetic for ₹149 and ₹999 returned 14,900 and 99,900. |
| **FAIL** | Static checkout contract check: V1 response does not provide the `id` field expected by both checkout callers and returns its amount in rupees. No live checkout attempt was made. |
| **PARTIALLY WORKING** | Payment and membership document fields/types, invalid amount behavior, expiry/renewal, status consistency, partial-failure risk, and legacy differences were inspected, but not validated against Firestore records or a test emulator. The month-end date calculation itself was executed and its rollover recorded. |
| **NOT IMPLEMENTED** | Membership verification idempotency protection; negative/decimal/event amount validation; persisted failed/cancelled/refund and webhook reconciliation behavior. |
| **NOT TESTED** | Manual authenticated HTTP requests; genuine Firebase token tests; Student A/B local database tests; live/deployed Firestore; Razorpay test-mode order/checkout/webhook/refund; fault injection against a database. |
| **BLOCKED** | The first sandboxed Jest attempt stopped at startup with Windows temp-path `EPERM`. The same commands passed after approved outside-sandbox execution. |

Passing mocked unit tests do not establish that all payment functionality works or that live integrations behave as intended.

## 6. Limitations

- No production or shared Firestore data was read or changed. Persisted record counts, historical field types, duplicates, and actual schema prevalence remain unknown.
- No live Razorpay request, payment, webhook, refund, or checkout was performed.
- Deployed Firestore rules, route exposure, indexes, and production configuration were not verified.
- The month-end behavior was observed for one local date example; billing policy for month-end, expiry boundaries, and renewal extension remains undecided.
- Git status/diff was unavailable because the project directory has no `.git` metadata. The reports record that limitation; pre-existing workspace changes cannot be ruled out from Git evidence.
- Existing tests mock Firebase/database behavior and do not cover payment document writes, membership replay, partial failure, invalid amounts, or checkout response shape.

## 7. Decisions and approvals required

Before any future implementation, coordinate and obtain decisions from:

- **Sri Nidhi — Payments/Memberships:** payment response contract, canonical fields/IDs, idempotency, amount validation, status mapping, payment fulfillment and expiry rules.
- **Sandharsh — Authentication/Admin:** UID/role boundary, legacy route handling, admin-granted memberships, profile projection, and any Firestore-rule/deployment implications.
- **Nandhitha — Events/Registrations/Reports:** event checkout and registration payment references, paid simulation boundaries, free-status semantics, event reporting impacts.
- **Sai Teja — Student/Mentor:** membership dashboard/history/expiry dependencies and keeping mentor payment-like records distinct from verified payments.
- **Business/finance stakeholders:** capture/authorization policy, prices and plan IDs, renewal/end-of-month/timezone rules, refund/cancellation/chargeback policy, historical payment trust/reconciliation, and reporting/retention requirements.

The audit lists the unresolved questions and proposed compatibility/migration decisions. No teammate approval or business decision is implied by this completion report.

## 8. Implementation boundary and phase status

No payment implementation, membership implementation, or database migration was performed as part of Phase 2. No production/shared Firestore data, live payment credentials, or real payment was used. The canonical schema and migration recommendations remain proposals for separate approval. Phase 3 has not started.

Phase 2 — Payment and Membership Schema Audit is complete as an audit and testing deliverable. All identified implementation issues remain documented for separately approved future work.
