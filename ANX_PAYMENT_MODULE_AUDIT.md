# ANX Club — Razorpay, Memberships and Payments Audit

Scope: read-only review of the checked-in repository at ANX-CLUB-main. Findings describe source behavior; no production Razorpay or Firebase deployment was exercised.

## 1. Executive Summary

The repository has a partially wired membership checkout and multiple competing Razorpay implementations. The membership UI uses the client helper in src/modules/module3/lib/razorpay.ts, which calls /api/v1/payments/create-order and /verify. The v1 order route derives membership prices server-side (₹149 monthly / ₹999 annual), stores a pending payment, and the v1 verification route checks a Razorpay HMAC before writing membership state.

There are critical gaps. The shared authenticate helper accepts predictable mock/token strings as identities. Membership fulfillment is non-atomic and replayable, and does not verify provider-side captured status/amount. The paid event modal falls back to simulated registration if the public key is absent and, even after Razorpay verification, calls the same simulated registration path. That API trusts client-supplied payment details and can issue a paid registration without verified payment. Legacy payment routes also accept arbitrary client amounts, have no authentication, and use dummy credential fallbacks.

No webhook endpoint or webhook signature handling was found. Student payment history was not found. Admin analytics aggregates paid records but is not a reconciliation report. Student Head external-only behavior and its URL model are unverified.

Priorities: P0 fix identity and event-payment bypasses and make membership fulfillment idempotent/atomic; P1 add provider-state verification, webhook processing, canonical schemas and required membership/event rules; P2 reports, operational error handling and broader tests.

## 2. Repository and Architecture Overview

- Verified: Next.js 14 App Router, TypeScript/React, npm, Firebase client/Admin SDKs, Razorpay Node SDK ^2.9.6 and Jest dependencies. Evidence: package.json:5-12,31-40,50-66.
- Main app is src/app; helpers are under src/lib; Firestore rules are firestore.rules. Parallel module trees exist under src/modules, including duplicate payment routes under module3.
- Firebase Admin setup is src/lib/firebase/admin.ts:1-38. It reads FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY and the public storage bucket variable. Client config is src/lib/firebase/client.ts:7-15 and uses NEXT_PUBLIC_FIREBASE_* variables.
- Identity helper is src/lib/auth.ts:4-51. Admin auth helper is src/lib/firebase/admin-auth.ts:13-125. Middleware exempts payment paths from its own auth gate at src/middleware.ts:24-28, so route handlers must enforce auth.
- .env.example declares NEXT_PUBLIC_RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET. Values were not read or reported. README.md:19-23 names the first two and Firebase Admin credentials. Runtime environment values and test/live mode are Unverified. No webhook code reference was found.
- The project directory had no .git directory, so Git status/diff could not be used.

## 3. Payment and Membership File Inventory

| Path | Responsibility |
|---|---|
| src/app/(dashboard)/membership/page.tsx | Membership UI, monthly/annual selector, checkout callback (:14,20-34,36-89). |
| src/modules/module3/lib/razorpay.ts | Client helper used by membership and paid-event UI; calls v1 payment APIs (:1-45). |
| src/lib/razorpay.ts | Duplicate client helper with the same v1 API contract (:1-45). |
| src/app/api/v1/payments/create-order/route.ts | Authenticated order creation, server pricing, pending payment record (:7-118). |
| src/app/api/v1/payments/verify/route.ts | Signature check, membership activation, paid event registration (:7-215). |
| src/lib/payments/razorpay.ts | Razorpay client, paise conversion and HMAC comparison (:1-61). |
| src/app/api/razorpay/order/route.ts and verify/route.ts | Legacy unauthenticated arbitrary-amount order and verify paths (order :1-42; verify :8-107). |
| src/modules/module3/app/api/razorpay/order/route.ts and verify/route.ts | Duplicate legacy implementation; dummy fallback and client-controlled data (order :4-40; verify :8-83). |
| src/components/events/PaidEventCheckoutModal.tsx | Paid event checkout and simulated registration fallback (:42-134). |
| src/app/api/v1/events/[id]/register/route.ts | Registration endpoint that can mark a registration paid without verified payment (:74-97,131-155). |
| src/app/api/events/register/route.ts | Alternate registration route; body-supplied user identity, partial paid-event guard (:7-26,42-75). |
| src/lib/auth.ts, src/lib/firebase/admin-auth.ts, src/middleware.ts | Shared server identity/admin controls and middleware behavior. |
| src/modules/module3/components/AuthContext.tsx | Client profile membership status and expiry handling (:141-160). |
| src/app/(admin)/admin/members/page.tsx | Admin member roster and tier toggle (:18-47,63-82). |
| src/app/api/v1/admin/analytics/route.ts | Admin analytics with paid payment aggregation (:7-19,75-89). |
| firestore.rules | Membership and payment client read/write rules (:54-62,112-119). |
| __tests__/razorpay-signature.test.ts | Tests a locally reimplemented HMAC helper, not production function (:8-29). |

## 4. Existing Feature Matrix

| Feature | Status | Evidence | Observed behavior and gap |
|---|---|---|---|
| Free plan | Partial | membership/page.tsx:20-23; firestore.rules:24-29 | Free profile is a default, but no server-side free activation or plan management flow found. |
| Monthly/annual plans | Partial | membership/page.tsx:20,88-90; create-order:14-27 | UI/backend prices agree at ₹149/₹999. Amounts and benefits are hardcoded; no plan catalog. |
| Plan creation and benefits | Missing | Payment/membership routes search | No plan CRUD or backend benefits configuration found. |
| Membership amount tampering | Implemented protection in v1 | create-order:14-27 | Client amount is ignored; server derives amount from period. Unsupported periods silently become annual, so enum validation is needed. |
| Checkout/order creation | Partial | membership/page.tsx:36-80; create-order:7-45 | Authenticated route stores order-linked pending record. Multiple open orders and persistence failure after external order are not handled robustly. |
| Membership signature verification | Partial | verify:24-61; lib/payments/razorpay.ts:42-60 | HMAC over order ID/payment ID; timing-safe comparison. No provider payment-state/amount fetch and no replay guard. |
| Membership activation/expiry | Partial | verify:44-77; module3 AuthContext:159-160 | Sets profile fields and appends active membership record; expiry adds calendar months. Writes are not atomic; retries can duplicate records/reset expiry. |
| Renewal/upgrade/active membership | Missing | membership page and verify route | No active membership guard, renewal policy or upgrade/proration flow. |
| Current membership lookup | Partial | verify:64-77; module2/services/membershipService.ts:42-66 | Payment writer creates auto-ID membership docs; module2 reader requests document keyed by user ID. Schema mismatch. |
| Webhook | Missing | payment routes; .env.example | No webhook endpoint, signature validation, event processing or idempotency. |
| Payment records | Partial | create-order:28-37,90-100; verify:57-61,169-174 | V1 uses order ID, pending then paid. Legacy routes use payment ID and success status, conflicting with analytics. |
| Student payment history | Missing | active src/app search | Firestore allows owner reads, but no student history page/API found. |
| Admin payment reports | Partial | api/v1/admin/analytics/route.ts:75-89 | Aggregate paid total only. No detailed reconciliation; fallback returns fixed sample metrics (:102-120). |
| Company Admin paid events | Partial / broken UI flow | PaidEventCheckoutModal.tsx:87-111; verify:103-180 | Backend verified transaction exists, but modal calls simulated registration afterward and does so directly without public key. |
| Student Head external-only events | Unverified | event page and event model search | No external registration URL/ownership-specific branch found. Same payment modal may be mounted. Coordinate with Events owner. |

## 5. Membership Plans and Lifecycle Findings

Verified facts: UI prices are ₹149 monthly and ₹999 annual (src/app/(dashboard)/membership/page.tsx:88-90); backend independently uses those values (create-order/route.ts:20-27). Annual is default. Verification computes expiry from current server date and writes users/{uid} fields plus an active memberships document (verify/route.ts:44-77). AuthContext downgrades expired membership in client state only (module3/components/AuthContext.tsx:159-160).

**P0 — Replayable, non-atomic activation.** src/app/api/v1/payments/verify/route.ts:44-77 never requires the payment record to still be pending and writes the user, payment, and new membership record separately. A valid callback replay can extend expiry and append duplicate memberships; partial write failure can leave inconsistent state. It should atomically transition a pending order once, update the canonical entitlement and return an idempotent result.

**P1 — Membership schema/read mismatch.** Verification creates random-ID membership docs (:64-77), while src/modules/module2/services/membershipService.ts:42-66 reads memberships/{userId}. UI/auth status uses the user profile instead. Define one canonical status source and document key; calculate expiry server-side.

**P1 — Plan validation and lifecycle are incomplete.** Any billing period other than monthly is treated as annual (create-order:14,20-21; verify:47,69). No free activation route, renewal/upgrade rules, or active-membership guard found. Replace string inference with a validated plan ID resolved from a server catalog.

## 6. Razorpay Configuration and Order Creation Findings

Verified: Razorpay names are NEXT_PUBLIC_RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET. src/lib/payments/razorpay.ts:4-11 fails closed for missing order credentials; the secret is server-side in that helper. Membership UI uses public key ID at page.tsx:52. Test/live mode and deployed values are Unverified.

**P0 — Legacy arbitrary-price routes and dummy fallback.** src/app/api/razorpay/order/route.ts:4-20 and module3/app/api/razorpay/order/route.ts:4-20 instantiate Razorpay with dummy key/secret fallbacks, accept a body amount and only test truthiness. They do not authenticate or persist an owned pending order. Legacy verify routes are also unauthenticated and accept client identity/payment metadata. The visible membership helper calls v1 instead, but these public routes remain callable and unsafe. Remove/disable or secure them; fail closed and compute prices server-side.

V1 create-order authenticates via authenticate() (lines 7-18), computes membership amount server-side (20-27), and for events fetches event/user, calculates event price, checks seats and duplicate registration (47-76). It persists pending payment records (28-37,90-100). The client helper passes amount, but the route does not consume it. Event/order validation and error handling remain minimal, and an external order may be stranded if Firestore persistence fails.

## 7. Payment Verification and Webhook Findings

The v1 helper uses HMAC-SHA256 and timingSafeEqual after length validation (src/lib/payments/razorpay.ts:51-60). The route requires signature fields and checks the stored payment belongs to authenticated UID (verify:24-42). This comparison is sound in isolation.

**P0 — Verification equates signed checkout response with settled expected payment.** No Razorpay API fetch checks captured status, order association, currency or amount before fulfillment. Add provider-side confirmation or verified webhook-based settlement, including expected amount/order/currency comparisons.

**P1 — No webhook.** No handler references RAZORPAY_WEBHOOK_SECRET; no signed raw-body verification, event allowlist, replay/idempotency or payment synchronization exists. Frontend callback is the only settlement mechanism found. Do not infer a webhook from .env.example.

Legacy src/app/api/razorpay/verify/route.ts compares HMAC in a timing-safe manner but accepts client userId, amount and paymentType, creates records without a locally owned pending order, and may activate membership based on client paymentType (:8-84). Module3 duplicate verifier uses plain string comparison and dummy secret fallback (:20-27) and the same client data trust (:30-61).

## 8. Firestore Payment Records and Membership Data Flow

V1 creates payments/{order.id} with userId, amount, INR, status pending, membership billing period or event reference and server timestamp (create-order:28-37,90-100). Verification marks it paid and records paymentId/verifiedAt (verify:57-61,169-174). Membership docs include userId/memberId, plan, status, dates, Razorpay IDs and amount (verify:64-77).

Legacy paths key by payment ID and use status success/timestamp/client values (src/app/api/razorpay/verify/route.ts:36-54). Analytics filters status paid only (src/app/api/v1/admin/analytics/route.ts:78-84), so legacy successes are omitted. Random membership keys conflict with reader keyed by UID (see §5).

Firestore rules restrict payment reads to owner/admin and deny client writes (firestore.rules:112-119); memberships are owner/admin read and writes denied (:54-62). Admin SDK server routes bypass these rules. eventRegistrations allows authenticated create (:43-51), but server endpoints also use Admin SDK. Whether deployed rules match checked-in rules is Unverified. No card number/CVV storage found; keep all sensitive card data with Razorpay.

## 9. Student Payment History and Admin Payment Reports

Student history: Missing; owner reads are permitted by rules but no UI/API found.

Admin reports: Partial. v1 admin analytics checks admin role (api/v1/admin/analytics/route.ts:7-19) and aggregates status=paid amounts (:75-89). No detailed payment listing, date/status filters, refunds, exports or reconciliation found. On error it returns hardcoded sample counts and revenue with HTTP 200 (:102-120), which can mislead administrators; failures should be visible and not represented as real payment metrics.

## 10. Paid Event Payment Integration Findings

### Company Admin-created events

Backend order creation fetches event data, calculates price from Firestore rather than client amount, checks seats/duplicates and stores a pending record (create-order:47-100). V1 verify transaction checks event/payment/order/user association, duplicate registration and capacity, then writes registration, marks payment paid and increments seats (verify:103-180). This is the strongest backend path.

**P0 — Reachable paid event UI bypasses verified fulfillment.** src/components/events/PaidEventCheckoutModal.tsx:87-111 creates and verifies an order, but then calls handleSimulatedPayment(). That function posts client-generated IDs/status to /api/v1/events/{id}/register (:42-64). If public Razorpay key is absent, the modal goes directly to simulation (:87-91). The API computes event price but sets paymentStatus paid whenever price > 0 without verifying any payment (src/app/api/v1/events/[id]/register/route.ts:74-97), creates registration and confirmed status (:131-155), then can send a ticket/email (:173-224). Auth failure also falls back to body userId/default ID (:8-15). An unpaid registration can therefore be represented as paid. Fulfill only through the verified, server-owned order path; eliminate simulation and client-controlled paid fields.

Another API, src/app/api/events/register/route.ts:18-26 trusts body userId; its paid-event gate only rejects if both event.price and premiumPrice are positive (:42-45). Confirm callers and close the path with Events owner.

### Student Head-created events

Unverified: no external registration URL field or Student Head-specific branch was found in searched event types/pages/routes. src/app/(dashboard)/events/[id]/page.tsx:18,372 mounts the same modal; order API checks no creator/owner type (create-order:47-67). Coordinate canonical ownership field and external URL with Events owner. Enforce external-only behavior in both API and UI: URL present gives external link, URL missing means no registration action, and no ANX payment/internal registration for these events.

Events coordination includes creator ownership, external URL model, price source, event registration endpoint and seat counter. Payment module should own settlement and payment linkage, not duplicate event fulfillment.

## 11. Security and Data Integrity Findings

1. **P0 — Mock credentials accepted as identities.** src/lib/auth.ts:26-43 accepts strings beginning mock_, session_, usr_, admin_ or containing admin as UID without Firebase token verification. V1 payment routes rely on this helper (:9). An attacker can select a UID-like bearer/cookie value; exploitability depends on document state, but this breaks the identity boundary. Use verified Firebase identity only in deployed payment handlers. Coordinate with Authentication owner. Similar demo-token acceptance exists in src/lib/firebase/admin-auth.ts:32-68.
2. **P0 — Client-trusted paid event registration.** See §10: fabricated payment identifiers/status can create confirmed paid registration and ticket.
3. **P0 — Membership callback replay and partial writes.** See §5: no pending-state transition, no transaction/idempotency in membership branch.
4. **P0 — Legacy unauthenticated routes.** /api/razorpay/* and module3 equivalents accept client amount/identity and dummy credentials; protect/disable.
5. **P1 — No provider payment-state/amount confirmation.** Signature does not validate expected amount/captured state; see §7.
6. **P1 — Conflicting schemas/statuses.** Order ID vs payment ID document keys; paid vs success statuses; random membership doc IDs vs UID lookup. Analytics/readers can miss or misstate records.
7. **P1 — Weak input validation.** billingPeriod not enum-checked; event prices/currency and malformed fields not rigorously validated. Legacy routes call substring on request values without robust schema.
8. **P2 — Fabricated analytics fallback.** API returns sample revenue on backend errors, as described in §9.
9. **Unverified — Deployed Firestore rules.** Checked-in rules deny payment writes, but server Admin SDK bypasses rules; verify deployment and API enforcement.
10. No sensitive card data storage was observed. Do not store card numbers/CVV.

## 12. Test Coverage and Verification Results

Only payment-specific test found is __tests__/razorpay-signature.test.ts. It implements its own HMAC function rather than importing src/lib/payments/razorpay.ts production code, so production regressions are not covered. No membership, order route, payment record, webhook or paid-event integration tests found. Other tests cover admin auth/users and gamification.

Command executed: npm test -- --runInBand __tests__/razorpay-signature.test.ts

Actual result: npm attempted jest --runInBand; PowerShell reported 'jest' is not recognized. No tests ran. No packages were installed. No build/lint run because they may create cache/build artifacts. No Firebase or Razorpay calls, migrations or live payments were performed.

Write tests for: production HMAC valid/tampered/malformed/missing-secret cases; auth rejection of mock tokens; server plan/event pricing and missing config; provider captured/amount/currency mismatch; pending-only idempotent membership activation, expiry edges and atomic failures; event payment-only registration, duplicate callbacks and seat races; Student Head external URL present/missing; owner/admin payment access and canonical analytics. CI/integration tests should use isolated test credentials/project.

## 13. Integration Risks and Teammate Dependencies

| Shared boundary | Risk | Coordinate with |
|---|---|---|
| Firebase identity and admin roles | Mock tokens accepted in server helpers; payment routes rely on helper. | Authentication owner: verified UID/session and role claims, demo auth isolation. |
| users/{uid} membership fields | Payment writes membershipType, membershipExpiry and role; AuthContext/admin tools read/update them. | Authentication/Admin owner: canonical fields, entitlement authority, manual overrides/rules. |
| memberships collection | Payment writer uses random IDs; module2 reader uses UID key. | Data/model owner: one schema and key, active status semantics. |
| payments collection | V1 order key/status paid vs legacy payment key/status success; analytics filters paid. | Payment and Admin reporting owners: canonical record schema and status transitions. |
| events/eventRegistrations | Payment flow uses event prices; modal separately registers; ownership type not checked. | Events owner: creator field, URL, price source, registration endpoint and counters. |
| Firestore rules/Admin SDK | Client rules deny payment writes, but Admin SDK bypasses; registration create rule is broad. | Authentication/Events owners: deployed rules and API-only invariants. |
| Environment/deployment | Public key, secret mode and unused webhook secret. | Deployment owner: test/live separation; never share secret values. |
| Duplicate module trees | Legacy routes conflict with canonical v1 paths. | Integration lead: declare active APIs and retire stale ones. |

Files to start with: src/lib/auth.ts (with Authentication owner), src/app/api/v1/payments/verify/route.ts, src/app/api/v1/payments/create-order/route.ts, src/lib/payments/razorpay.ts, then src/components/events/PaidEventCheckoutModal.tsx and src/app/api/v1/events/[id]/register/route.ts with Events owner.

Avoid independently editing shared AuthContext, admin membership/analytics pages, event data models/registration routes, or firestore.rules before coordination.

## 14. Prioritized Implementation Plan

- **P0:** Replace mock-token identity acceptance for production payment operations; make membership verification pending-only, atomic and idempotent; prevent paid event registration/tickets without verified server payment; remove no-key simulation and client-controlled paid fields; secure/disable legacy routes and dummy fallbacks.
- **P1:** Confirm provider payment state and amount/order/currency; add signed/idempotent webhook; define canonical plan and membership/payment schemas; enforce Student Head external-only behavior in UI and API; build student history and admin payment listing/reconciliation.
- **P2:** Tighten input validation, consistent pending/failed/cancelled/error behavior, order cleanup, seat race handling, operational logging without secrets, and honest analytics failures.
- **P3:** Optional richer plan benefits, exports and operational dashboards after integrity controls.

## 15. Recommended Implementation Sequence

1. Align with Authentication owner and test verified identity boundaries.
2. Define canonical plan/order/payment/membership schema with Admin/data owner.
3. Harden create-order with strict validation, server-side catalog/event pricing and safe config errors.
4. Implement provider confirmation and atomic idempotent fulfillment.
5. With Events owner, remove event simulation and enforce Company Admin internal fulfillment vs Student Head external-only links.
6. Add webhook and reconciliation; then history/admin reports.
7. Run unit/API/security tests in CI, followed by sandbox integration with isolated test credentials and Firebase project. No production transaction before these pass.

## 16. Questions That Need Clarification Before Implementation

1. Should only /api/v1/payments/* remain, or do external callers use legacy /api/razorpay/* routes?
2. Is canonical membership one doc per user or immutable purchase history plus a current entitlement?
3. Are monthly/annual products one-time purchases or auto-renewing? What are upgrade/proration rules?
4. Which field identifies Company Admin vs Student Head event ownership, and what is the external URL field?
5. Who owns refunds, failed-payment follow-up and seat reservation expiry for paid events?
6. Which Authentication mechanism is authoritative in production? Are mock tokens local-development only?
7. Is hardcoded admin analytics fallback intentionally demo-only?

## Final Questions — Explicit Answers

1. **What membership/payment functionality already works?** Code exists for monthly/annual UI, authenticated v1 order creation with server-derived price, pending records, HMAC checks and membership writes. Live success is Unverified.
2. **What is incomplete, missing or broken?** Atomic/idempotent activation, provider payment-state checks, canonical membership lookup/renewal, webhooks, student history/reconciliation and safe event fulfillment.
3. **Is Razorpay order creation implemented correctly?** V1 membership branch has useful auth/server pricing but relies on vulnerable shared auth and lacks validation. Legacy routes are unsafe arbitrary-price endpoints.
4. **Is payment signature verification secure?** V1 HMAC/timing-safe comparison is sound in isolation; end-to-end settlement is insufficient due to missing provider state/amount checks, replay and auth bypasses. Legacy verifier is weaker.
5. **Are webhooks implemented and verified?** No webhook handler was found. Production-side infrastructure is Unverified.
6. **Can membership be activated without a verified payment?** Intended v1 branch requires a valid signature and owned local order, but replay and provider status are unchecked. Legacy branch can activate from client paymentType after HMAC without an owned pending order; admin/manual pathways also exist.
7. **Are payment records stored and linked correctly?** V1 links order to authenticated user, but schema conflicts with legacy paths and replay can duplicate memberships; consistency is not reliable.
8. **Which exact files should I work on first?** src/lib/auth.ts (with Authentication owner), src/app/api/v1/payments/verify/route.ts, src/app/api/v1/payments/create-order/route.ts, src/lib/payments/razorpay.ts, then event modal and registration route jointly with Events.
9. **Which files should I avoid because teammates own them?** Coordinate before changing auth helpers, AuthContext, admin member/report screens, event pages/types/routes, and firestore.rules.
10. **Safest first implementation task?** Test and close the server identity boundary so only verified Firebase identities can access payment operations; concurrently prioritize removal of paid event simulation.
11. **Which tests first?** Production HMAC, mock-token rejection, server pricing/config, provider-state mismatch, membership pending/idempotency/expiry/atomicity, paid event verified-only registration, duplicates/seat races, Student Head URL behavior, payment read/admin access.
12. **What coordinate with Events owner?** Ownership field, external URL, Student Head-only behavior, price source, registration APIs/counters, payment-confirmed ticket issuance and removal of simulation.
13. **What coordinate with Authentication owner?** Firebase UID/session verification, disabling mock tokens in deployed APIs, admin claims, user membership fields and deployed Firestore rules.

## Audit Completion Confirmation

- No project source files were modified; only this requested report was created.
- No dependencies were installed or changed.
- No Firebase data was written.
- No payment was initiated.
- No secret values were exposed.
- Findings are based on checked-in repository evidence; external configuration and live behavior remain unverified.
