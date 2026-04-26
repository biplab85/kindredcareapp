# Biometric Data Handling Policy

**Status:** Phase 15.D — MVP audit + stated policy. Full implementation lands when Veriff integration completes (Phase 4 deferred — pending API key).

## Policy statement

KindredCare does **not** retain raw biometric data on its servers. Specifically:

- ID document photos (front, back) are **transient**. Once Veriff returns a verification result, the local copy is deleted.
- Selfie images are **transient**. Same lifecycle as ID photos.
- Only the following are retained long-term:
  - Veriff verification result (`status`: cleared / flagged / rejected)
  - Veriff session ID (provider reference, not the underlying media)
  - Timestamp of verification

This aligns with PIPEDA's data-minimization principle: collect only what is necessary, retain only as long as required.

## Current MVP gap

Phase 4 of the build plan defers full Veriff integration (needs API key). The current `Admin\VerificationController::uploadId` and `uploadSelfie` endpoints store images locally in `storage/app/private/verifications/{user_id}/`.

This is acceptable for MVP only because:

1. The stub channel is restricted to test caregivers
2. Storage path is private (700 permissions, no public symlinks)
3. Files are encrypted at the disk level via macOS FileVault / Linux LUKS in production

## Production migration plan

When Veriff API key lands:

1. Replace local upload with the Veriff Web SDK (client-side capture, direct upload to Veriff)
2. Remove `uploadId` / `uploadSelfie` endpoints entirely
3. Add a one-time cleanup migration to delete every file under `storage/app/private/verifications/`
4. Verify with a code audit that no part of the codebase reads these paths

## Interim mitigation: scheduled cleanup

A `php artisan verifications:purge-stale` command runs daily (Phase 9 cron infrastructure already in place) to delete any file under `storage/app/private/verifications/` older than 30 days. This bounds retention even in the stub channel.

## Verification

- Code audit performed: `2026-04-26`
- File system permissions verified: `storage/app/private/` is `0700`
- No public-facing symlinks to verification files exist

## Audit history

| Date | Auditor | Finding | Action |
|---|---|---|---|
| 2026-04-26 | Engineering | Local storage gap acknowledged; mitigated by 30-day TTL | Migration deferred to Veriff integration |
