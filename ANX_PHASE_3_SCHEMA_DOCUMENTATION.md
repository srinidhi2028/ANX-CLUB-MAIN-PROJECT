# ANX Club — Phase 3 Schema Documentation

**Decision state: PARTIALLY APPROVED FOR THE MEMBERSHIP PROJECTION ONLY.** The user approved `memberships/{uid}` for the current projection, `memberships/{uid}/history/{orderId}` per payment term, UTC timestamps, month-end clamping, and rejecting early renewal. This does not approve a complete canonical payment schema, event schema, grants, refunds, reporting, or migration.

## Payment record currently used by the membership flow

The code expects `payments/{razorpayOrderId}` to identify the payment. The following fields are consumed/written by the changed membership flow; do not treat this list as a company-approved canonical model:

| Field | Type | Meaning |
|---|---|---|
| `orderId` | string | Razorpay order reference; also used as the Firestore document ID. |
| `userId` | string | Authenticated Firebase UID; ownership source. |
| `amount` | number | Rupees stored locally for the current API contract. |
| `amountInPaise` | integer | Returned in the create-order API response for Checkout; **not persisted** in the current payment document. |
| `currency` | string | `INR`. |
| `paymentType` | string | Written for membership orders (`membership`); absent from event-order writes. |
| `eventId`, `eventTitle` | string | Written for event orders; target semantics await event-policy approval. |
| `billingPeriod` | `monthly` \| `annual` | Written for membership orders only. |
| `status` | string | Starts as `pending`; membership verification changes to `paid` only after provider capture. Full enum/mapping remains pending. |
| `providerStatus` | string | Added by membership verifier for observed provider state, e.g. `captured`. |
| `fulfillmentStatus` | string | Added by membership verifier, e.g. `completed` or `retry_required`. |
| `paymentId` | string | Razorpay payment ID after verification. |
| `createdAt`, `verifiedAt` | server timestamp | `createdAt` written on order; `verifiedAt` written on successful capture handling or retry-required conflict. |

Exact status lifecycle, attempt storage, order-request idempotency key, failure/refund fields, plan version snapshots and legacy mapping remain unapproved. Existing legacy records may use payment-ID keys, rupee amounts and `success` status; do not reinterpret them automatically.

## Approved membership projection and history layout

The user approved this ID relationship and expiry rule. The implementation writes the projection and history in the same Firestore transaction, but this has only been tested with mocks, not an emulator.

### `memberships/{uid}` — current projection

| Field | Type | Meaning |
|---|---|---|
| `userId` | string | Firebase UID / document ID. |
| `tier` | string | Existing reader-compatible value `Premium`. |
| `status` | string | `active` in the paid fulfillment path. Broader state policy remains open. |
| `plan`, `billingPeriod` | string | `monthly` or `annual`. |
| `amount` | number | Rupees (149 or 999). |
| `currency` | string | `INR`. |
| `paymentId`, `orderId` | string | Provider payment and order references. |
| `startDate`, `endDate`, `expiresAt` | ISO-8601 UTC strings | Current projection fields; `expiresAt` preserves the existing reader contract. |
| `updatedAt` | Firestore server timestamp | Projection update time. |

### `memberships/{uid}/history/{orderId}` — one deterministic term per order

| Field | Type | Meaning |
|---|---|---|
| `userId`, `orderId`, `paymentId` | string | Owner and payment relationship. |
| `plan`, `billingPeriod` | string | Term plan. |
| `amount` | number | Rupees. |
| `currency` | string | `INR`. |
| `status` | string | `active` for the newly fulfilled term. |
| `startDate`, `endDate` | ISO-8601 UTC strings | Start and calendar term expiry. |
| `createdAt` | Firestore server timestamp | History creation time. |

Example values below are dummy only; no record was written:

```json
{
  "userId": "uid_test_student_a",
  "plan": "Premium",
  "billingPeriod": "monthly",
  "status": "active",
  "amount": 149,
  "currency": "INR",
  "paymentId": "pay_test_dummy_001",
  "orderId": "order_test_dummy_001",
  "startDate": "2026-01-31T12:00:00.000Z",
  "endDate": "2026-02-28T12:00:00.000Z",
  "expiresAt": "2026-02-28T12:00:00.000Z"
}
```

```json
{
  "userId": "uid_test_student_a",
  "orderId": "order_test_dummy_001",
  "paymentId": "pay_test_dummy_001",
  "plan": "Premium",
  "billingPeriod": "monthly",
  "amount": 149,
  "currency": "INR",
  "status": "active",
  "startDate": "2026-01-31T12:00:00.000Z",
  "endDate": "2026-02-28T12:00:00.000Z"
}
```

## Lifecycle and relationships

Membership order: authenticated create request → pending payment document → Razorpay Checkout → HMAC signature and provider order/payment verification → provider confirms captured and amount/currency match → a Firestore transaction marks payment paid/fulfillment completed and writes the UID projection plus deterministic history term. Repeating verification for the same order must not duplicate the term or extend the expiry. If a different order is captured while a membership remains active, early renewal is rejected; the payment is marked retry-required for manual/recovery handling and no second term is created.

For a new term, monthly expiry is the same UTC calendar day next month, clamped to that month’s last day; annual expiry is one calendar year later with leap-day clamp. This UTC behavior is approved in this conversation; broader inclusive/exclusive access boundary and user-facing timezone are still open.

## Compatibility, ownership and open decisions

Legacy membership docs may have random IDs and `plan`/`endDate`; existing reader expects `memberships/{uid}` with `tier`/`expiresAt`; profile fields may duplicate current status. Legacy payment IDs/status/amount units vary. Existing documents must remain unchanged until reconciled and separately approved for migration.

Known cross-module dependencies include `src/modules/module2/services/membershipService.ts`, `src/modules/module2/types/dashboard.ts`, student dashboard readers, admin membership/profile routes and analytics, `firestore.rules`, event checkout and registration routes/components. Sai Teja owns student membership readers; Sandharsh owns shared auth/admin/profile paths; Nandhitha owns events. The shared Razorpay helper and verify route are consumed by event checkout; no event-owned files were changed. Nandhitha’s compatibility review is required.

Open company decisions include canonical payment status enum and amount units; order idempotency/reservation policy; retry/attempt retention; admin/manual grants; payment history visibility/retention/report definitions; event payment boundaries; refunds/disputes/webhooks; legacy API external clients; timezone/access boundary. No full schema migration or production write is authorized by the partial membership approval.

## Firestore database selection finding

`src/lib/firebase/admin.ts` initializes Admin Firestore with `app.firestore()` and does not specify a database ID. The Admin SDK therefore targets the default database. No `FIRESTORE_DATABASE_ID` setting or emulator host is configured in this checkout. The supplied fallback warning is emitted for SDK error code 5 (`NOT_FOUND`); this is consistent with, but does not prove, a missing/default-vs-named database mismatch. The route now captures a sanitized code/message/stack, but no Firebase query was run from this task. Confirm the actual Console database ID and compare it with the emitted error before changing database selection or any persisted schema.
