# ANX Club — Phase 3 Pending Decisions and Coordination

**Status: PARTIALLY APPROVED; additional decisions and owner reviews remain.**

## Explicit user approvals recorded in this conversation

| Decision | Approved rule | Scope |
|---|---|---|
| Membership layout | `memberships/{uid}` is the current projection; `memberships/{uid}/history/{orderId}` stores each payment-backed term. | Membership fulfillment only; does not approve a full payment schema or migration. |
| Time and expiry | Store UTC timestamps; clamp calendar monthly/yearly expiry to the target month’s last day (Jan 31 → Feb 28/29). | Membership term calculation. |
| Early renewal | Reject an order while the current membership remains active. | Membership server behavior; captured payment conflicts require operational recovery. |

## Still pending business/schema decisions

| Topic | Needed decision / owner |
|---|---|
| Canonical payment schema and status lifecycle | Finance/company and Sri Nidhi; define payment vs fulfillment state, amount units, supported states and transition evidence. |
| Order creation idempotency and attempts | Finance/company and Sri Nidhi; define request key, retry behavior, retention and conflict semantics. |
| Captured payment with failed fulfillment | Sri Nidhi, support/company; agree on retries, operator process and student/admin display. |
| Membership grants and plan pricing/version | Company/finance, Sandharsh and Sri Nidhi; approve manual/complimentary grants, grant evidence, plan identifiers and immutable price snapshots. |
| Timezone/access boundary | Company and Sri Nidhi; UTC storage approved, but inclusive/exclusive expiration instant and display timezone remain undecided. |
| Event registration/payment policy | Nandhitha and company; preserve Student Head external-only rules and define Company Admin paid/free handling. |
| Refunds, disputes, chargebacks, webhooks | Company/finance and Sri Nidhi; either approve exact behavior or explicitly mark out of scope. |
| Student history/admin reporting | Sai Teja, Sandharsh, company/finance; visibility, retention, pagination and financial definitions. |
| Legacy routes and records | Sri Nidhi, Sandharsh and any external consumer owner; identify callers, trust existing records and decide deprecation/compatibility. |
| Actual Firestore/Razorpay failure diagnosis | Sri Nidhi / credential owner; the supplied Firestore fallback warning implies SDK error code 5 (`NOT_FOUND`), but its message/stack were previously suppressed. The payment route now logs sanitized Firestore details and returns a stage-specific 503. Repeat the signed-in request locally against a confirmed test database and share the safe log; verify the Console database ID against Admin SDK's default database selection. Separately, one Razorpay test-order attempt returned no HTTP response and was not retried. |

## Required teammate coordination

- **Sandharsh:** shared auth/admin/profile/rules impacts. General shared auth was not edited; payment-specific bearer handling remains local to the Razorpay helper.
- **Sai Teja:** student membership reader/dashboard compatibility with new UID projection and history.
- **Nandhitha:** paid event flow compatibility. Existing `RegisterModal` consumers send to the shared `/api/v1/payments/verify` route using registration-specific order data; no event-owned files were changed. Review is needed because the new verifier requires an owned payment record and provider evidence.

## Environment blockers and safety

- Firebase Emulator not configured/available; no Firestore integration was run.
- The configured Razorpay key ID was checked for the `rzp_test_` prefix without printing its value. One Test Mode order request was attempted but returned no HTTP response (`fetch failed`); the key/secret pair and provider response remain unvalidated. No payment was captured.
- Safe local metadata checks found `FIREBASE_PROJECT_ID` and `NEXT_PUBLIC_FIREBASE_PROJECT_ID` are both configured and equal; the service-account email suffix matches that project. This does not verify the private key/email pair, IAM permissions, database ID, or whether the target is isolated test data. No Firebase request was made, and `FIRESTORE_EMULATOR_HOST` is not configured.
- The V1 create-order route now logs sanitized provider status/code/description and Firebase code/message/limited stack according to the failing stage. The local Firebase cause still needs a fresh log. The Razorpay test-order request had no HTTP response and was not retried because its provider-side outcome is ambiguous.
- Git status/diff cannot be used because the current checkout path reports that it is not a Git repository; pre-existing changes cannot be audited through Git metadata.
- No production migration, database write, Firebase rule/index/config change, dependency installation, live payment, commit, push or merge was performed.

## Gate

The approvals above authorize only the stated membership layout, UTC month-end expiry calculation and early-renewal rejection. They do not authorize broad schema adoption, event integration, migration, production rollout, payment reporting, webhooks, refunds or disputes. Phase 3 remains PARTIALLY WORKING pending implementation and evidence for those areas.

## Exact questions before the blocked implementation tasks

1. **Payment amount/schema:** Approve new payment documents storing `amountPaise` as the sole authoritative integer amount, with currency `INR`; should the existing rupee `amount` be retained temporarily as a compatibility field, or omitted on new writes? Legacy records would remain untouched pending a separately approved migration.
2. **Order idempotency:** Approve requiring a client idempotency key scoped to authenticated UID + purpose + target, returning the original order for an identical retry and `409` for a reused key with a different request body? Confirm the key lifetime/retention.
3. **Legacy root routes:** Can the root `/api/razorpay/order` and `/api/razorpay/verify` be changed to require verified Firebase identity and reject caller-supplied owner/amount, after external callers are confirmed? Repository search found no callers in `src` or tests, but external consumers are unknown.
4. **Event behavior:** Nandhitha, please confirm the Company Admin paid/free behavior and the Student Head external-only rule, including whether the legacy registration API must stop creating internal registrations for Student Head events. No event-owned source has been edited.
5. **Integration environment:** Which isolated Firebase Emulator/test project can be used, and can the credential owner confirm the configured Razorpay key/secret pair and restore network access? Before another provider order request, reconcile the previous attempt's unique test receipt or confirm no order was created.
6. **Out-of-scope lifecycle:** Should webhooks/reconciliation, refunds/disputes and payment-history/admin reporting be explicitly out of scope for this release, or should those be implemented after the relevant policy owners approve status, retention and access rules?
