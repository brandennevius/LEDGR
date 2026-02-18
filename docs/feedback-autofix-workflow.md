# Feedback to Autofix Workflow

This repository is configured with a fast feedback pipeline:

1. Submit feedback using the GitHub issue form: `Feedback Report`.
2. Scheduled workflow (`Feedback Triage`) labels issues by priority (`p0`-`p3`) and dedupes obvious repeats.
3. High-priority issues (`p0`/`p1`) are labeled `autofix-ready`.
4. Workflow (`Autofix PR Bootstrap`) creates a `codex/issue-*` branch and a draft PR.

## Workflows

- `.github/workflows/feedback-triage.yml`
- `.github/workflows/autofix-pr.yml`

## Labels used

- `feedback`
- `triaged`
- `duplicate`
- `p0`, `p1`, `p2`, `p3`
- `autofix-ready`
- `autofix-in-progress`

## Trigger details

- `Feedback Triage`
  - Runs every 30 minutes and via manual dispatch.
  - Dedupe key: normalized issue title + summary field.
  - Duplicate issues are closed with a comment linking the canonical issue.
- `Autofix PR Bootstrap`
  - Triggers when an issue is labeled `autofix-ready`, or manually via dispatch with `issue_number`.
  - Creates/updates `.codex/queue/issue-<number>.md` on a `codex/issue-*` branch.
  - Opens a draft PR with a fix checklist.

## Suggested operating model

1. Keep feedback intake through the issue form so triage remains machine-readable.
2. Let `Feedback Triage` prioritize automatically.
3. Review `autofix-ready` queue and keep human approval before shipping.
4. Before release, run your production gate (`eas build`, `eas submit`) with a human check.

