# LEDGR Security Procedures

- Procedure owner: Branden Nevius
- Effective date: 2026-02-15
- Last reviewed: 2026-02-21

This document operationalizes `/Users/brandennevius/Desktop/LEDGR/docs/security/information-security-policy.md`.

## 1) Access Review Procedure (Quarterly)

Steps:

1. Enumerate production system users (hosting, database, source control, auth provider, Plaid dashboard).
2. Confirm each account has active business need.
3. Remove unnecessary access.
4. Confirm privileged accounts have MFA enabled where available.
5. Record completion in an access review log.

Evidence to retain:

- Date of review
- Reviewer name
- Systems reviewed
- Access removals/changes made

## 2) Vulnerability and Patch Procedure (Monthly)

Steps:

1. Review dependency vulnerability alerts (`npm audit` and repository alerts).
2. Patch high severity issues immediately; medium within 30 days.
3. Rebuild and smoke test critical API paths after updates.
4. Document unresolved risks with mitigation date.

Evidence to retain:

- Scan date
- Findings summary
- Patch PR/commit references

## 3) Change Security Review Procedure (Per Release)

Apply before deploying features that touch auth, Plaid data, or user data models.

Checklist:

- Authorization checks present on all new API routes
- Input validation and error handling implemented
- No secrets in code or client bundles
- Data minimization reviewed for new fields/integrations
- Rollback strategy documented
- RLS state validated for any new public-schema tables
- Rate-limit coverage validated for new high-risk endpoints

Evidence to retain:

- Release note with security checklist completion

## 4) Incident Response Procedure (As Needed)

Steps:

1. Detect and triage incident severity.
2. Contain impact (disable endpoint, revoke tokens, rotate keys).
3. Preserve evidence (logs, timestamps, affected resources).
4. Recover service safely.
5. Complete post-incident review with prevention actions.

Severity targets:

- High: begin response immediately
- Medium: begin response within 24 hours
- Low: begin response within 3 business days

Evidence to retain:

- Incident timeline
- Root cause
- Corrective actions and owners

## 5) Vendor Security Review Procedure (Annually or Before New Vendor)

Steps:

1. Review vendor security documentation and contractual terms.
2. Confirm least-data-sharing design.
3. Verify integration secrets management approach.
4. Record approved vendor purpose and data categories.

Evidence to retain:

- Vendor name
- Review date
- Data shared
- Decision and conditions

## 6) API Authorization Audit Procedure (Per Release + Quarterly Deep Audit)

Steps:

1. Enumerate all `src/app/api/**/route.ts` handlers.
2. Verify each route requires authenticated user context unless intentionally public (for example, verified webhooks).
3. Verify all database reads/writes are scoped to the authenticated user (`userId`) or explicit ownership checks.
4. Verify third-party identifier upserts (Plaid item/account/transaction IDs) cannot reassign cross-user ownership.
5. Document findings and patch references before release.

Evidence to retain:

- Route inventory reviewed
- Findings list with severity and file references
- Commit/PR links for remediations

## 7) Rate Limiting and Abuse Procedure (Per Release)

Steps:

1. Confirm rate limits exist on sensitive endpoints:
   - Plaid linking/sync endpoints
   - AI/LLM endpoints
   - Any high-cost mutation endpoint
2. Validate response behavior on threshold breach (HTTP 429 + `Retry-After`).
3. Review logs for repeated violations and tune thresholds.

Evidence to retain:

- Endpoint list and thresholds
- Test evidence of 429 behavior
- Tuning log (date, old/new limit, reason)

## 8) Data Deletion Procedure (On Request / Account Closure)

Steps:

1. Validate request source and account ownership.
2. Execute account-level deletion workflow.
3. Confirm deletion completion.
4. Log request and completion date.

Evidence to retain:

- Request date
- Completion date
- Data categories deleted

## 9) Procedure Review and Maintenance

- Review this document at least annually.
- Update procedures after major architecture or vendor changes.
- Keep evidence logs for at least 12 months.

## 10) AI Context Minimization Procedure (Per AI Feature/Change)

Steps:

1. Classify AI request intent (for example: transaction detail vs. cashflow summary).
2. Build query scope to minimum required records for the request.
3. Prefer aggregated financial context for AI prompts.
4. Only include transaction-level details when the user question explicitly needs it.
5. Validate prompt payload fields in code review before release.

Evidence to retain:

- API route/PR reference
- Prompt payload field list
- Reviewer confirmation that minimization rules were applied

## 11) Key Rotation Runbooks

- Plaid token encryption key management: `/Users/brandennevius/Desktop/LEDGR/docs/security/plaid-token-encryption-runbook.md`
