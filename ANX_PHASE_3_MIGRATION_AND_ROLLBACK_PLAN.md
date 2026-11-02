# ANX Club — Phase 3 Migration and Rollback Plan

**Status: NO MIGRATION PERFORMED.** Current code has additive payment/membership write-path changes for new membership purchases. No existing Firestore data, production/shared database, Firebase rules or indexes were accessed or changed. The approved membership document layout is not authorization for bulk migration.

## Current legacy shapes and compatibility

Phase 2 findings include V1 order-keyed payment records with amounts in rupees, legacy payment-keyed records with `status: "success"`, random-ID membership history documents using `plan`/`endDate`, a UID-keyed membership reader expecting `tier`/`expiresAt`, and profile-level membership fields. Their amount units, ownership and validity cannot safely be inferred from one another.

The current membership fulfillment path writes a UID projection and nested per-order history for newly verified orders. It does not backfill, rewrite, delete or normalize historical documents. The payment verification flow expects a payment document keyed by the Razorpay order ID and owned by the authenticated UID; compatibility with older unowned/legacy order documents is not established. The create-order and Firebase diagnostic improvements add no persisted fields and do not change this migration posture. No Firebase query or write was performed while investigating the reported code-5 (`NOT_FOUND`) failure; confirm the actual Firestore database ID before any database selection change.

## Future migration gates

1. Approve canonical payment schema/statuses, amount units, provider capture threshold, grants, retries, event boundaries, refunds/disputes, reporting and legacy-client policy.
2. Obtain written reviews from Sandharsh (shared auth/admin/profile/rules), Sai Teja (membership readers/student UI) and Nandhitha (event checkout/registration), and finance/company owners for business policy.
3. Establish an isolated Firebase Emulator or dedicated test project and verify projection/history readers and security rules before any production work.
4. Inventory legacy documents read-only; produce counts and a mapping manifest; label ambiguous owner, amount unit, provider state and entitlement cases for manual review.
5. Obtain separate production migration approval and verified backup/export plus restore rehearsal. Dry-run mapping and reconcile provider records before writing.
6. Use additive/versioned writes, preserve original IDs and source fields, track per-document outcomes and retries. Never multiply historical `amount` by 100 without source-specific proof.
7. Compare old/new reader results and financial totals before cutover. Keep rollback switches and monitor payment/fulfillment discrepancies.

## Rollback and recovery

No destructive rollback operation is appropriate because no migration has occurred. If the new membership payment flow causes an issue, disable its reviewed entry point and preserve payment/provider evidence; do not mark a captured payment as failed or create a second charge. Retry fulfillment for the same order idempotently after diagnosis. Do not delete projection/history/payment records automatically. Any production restoration must use an approved project-specific backup and tested restore procedure.

## Current limitations

No Firebase Emulator is available/configured in this checkout; no production/shared Firestore was touched. Git metadata is unavailable, so pre-existing source changes cannot be separated with a repository diff. Event callers use distinct registration/order behavior and require Nandhitha review before broad rollout. This document is a guarded plan, not authorization to migrate or deploy.
