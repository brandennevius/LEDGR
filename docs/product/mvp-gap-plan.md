# LEDGR MVP Gap Plan

## Purpose

This document turns the Copilot comparison and product/code audit into an execution plan.

Use it for:
- deciding whether LEDGR is ready for beta
- sequencing work before broader launch
- aligning product, engineering, and QA on ship criteria

## Executive Summary

LEDGR is not yet ready to position as a direct Copilot Money alternative.

LEDGR is close to ready for a narrow private beta if positioned as:
- AI-first spending and cash flow coach
- linked-account transaction review and categorization
- privacy-forward financial dashboard

Current blocker themes:
- incomplete consumer feature surface on mobile
- weak release quality and automated verification
- unfinished account lifecycle and trust controls
- underdeveloped Penny product loop relative to the coaching promise

## Readiness Call

### Ready now
- invite-only beta for users willing to tolerate some rough edges
- product framing centered on spending clarity, cash flow, and guided review

### Not ready now
- public launch as a Copilot replacement
- broad paid beta with high trust expectations
- growth push that depends on goals, wealth, or full account-management parity

## What Copilot Has That LEDGR Does Not Yet Match

Based on Copilot's current help center documentation, Copilot ships a broader surface that includes:
- working goals
- recurring transaction workflows
- tags
- manual transactions
- manual or closed-account workflows
- richer transaction review, filtering, bulk edit, and export
- investments support and broader net worth story
- Apple Card / Apple Cash / Savings support
- widgets and more mature dashboard customization

LEDGR does not need to match all of this immediately, but it does need to close the gaps that block a credible MVP.

## MVP Definition For LEDGR

LEDGR should be considered MVP-ready only when all of the following are true:

1. A new user can sign up, connect accounts, and understand the product without support.
2. Dashboard, transactions, categories, and accounts show internally consistent numbers.
3. Penny can answer useful personalized questions with clear grounding in the user's data.
4. Core transaction review flows are complete enough that users do not hit obvious "soon" placeholders.
5. Users can safely manage connections and understand how to remove data.
6. Release quality includes repeatable regression testing for the highest-risk flows.

## Current Gaps

### P0: Must Ship Before Broad Beta

#### 1. Finish or hide mobile Goals

Problem:
- Mobile exposes a Goals tab, but the screen is a placeholder.

Why it matters:
- This creates a trust gap immediately.
- It weakens the coaching promise because Penny talks about goals while the app surface is not ready.

Required work:
- Either remove Goals from the top nav until ready
- Or ship a real mobile goals surface using the existing web/backend goal data

Acceptance criteria:
- No placeholder goal screen in shipping mobile app
- Goal creation, progress, and explanation are understandable end to end

Suggested owner:
- Product + mobile

#### 2. Complete transaction filtering and search basics

Problem:
- Mobile transactions still show unfinished filters for account, recurring, and tag.

Why it matters:
- Transactions are the core trust loop for a finance product.
- Copilot's transaction workspace is one of its strongest areas.

Required work:
- ship account filter
- ship review-status parity
- ship true month/year selection
- remove placeholder rows
- tighten search behavior and empty states

Acceptance criteria:
- No "soon" placeholders in transaction filters
- User can answer: what did I spend, where, when, and what still needs review

Suggested owner:
- Mobile + API

#### 3. Ship proper account and data lifecycle handling

Problem:
- Current delete flow is partial and not a full user deletion flow.

Why it matters:
- This is a trust and privacy issue, not just a backlog item.

Required work:
- add real delete-account flow in Settings
- require strong confirmation and recent auth
- cascade through user-owned data
- audit-log the destructive event
- document retained records clearly

Acceptance criteria:
- User can request account deletion from app settings
- Deletion scope is complete and documented
- QA can verify no orphaned user data remains in primary tables

Suggested owner:
- Backend + product + legal/privacy

#### 4. Add a minimum viable QA gate

Problem:
- There is no meaningful first-party test harness today.

Why it matters:
- Finance apps cannot rely on manual spot-checking only.
- Regression risk is already visible in sign, sync, and UX consistency issues.

Required work:
- add API smoke tests for auth, policies, accounts overview, transactions list, plaid sync stubs
- add at least one mobile smoke path checklist for sign up, login, connect, sync, review
- create pre-release checklist and owner
- capture app version to backend deploy mapping

Acceptance criteria:
- Every release candidate runs a repeatable smoke suite
- Build promotion requires explicit pass/fail on the top 5 user journeys

Suggested owner:
- Engineering

### P1: Should Ship During Private Beta

#### 5. Improve connection management trust UX

Problem:
- Connection management is functional but still rough.
- "Add existing accounts" appears to reuse the same update path as reconnect/update login.

Why it matters:
- Users need to understand what is broken, what needs relink, and what each action does.

Required work:
- separate reconnect vs add-existing-account flows clearly
- show last sync time
- show per-connection health states
- improve explanations for action outcomes

Acceptance criteria:
- Each connection action has a distinct, understandable result
- User can tell whether issue is bank-side, credential-side, or stale-data-side

#### 6. Make Penny more actionable than chat

Problem:
- Penny has strong backend context shaping but weak product memory and follow-through.

Why it matters:
- This is LEDGR's best shot at differentiation.

Required work:
- persist chat and action state intentionally
- add suggested actions tied to user data
- add follow-up prompts tied to recent spending and goals
- add "why I said this" grounding hints

Acceptance criteria:
- Penny produces advice that references real account/category/cash-flow context
- User can act on at least one recommendation from inside the product

#### 7. Launch a working first-time experience

Problem:
- The app is still knowledge-heavy for a new user.

Why it matters:
- Conversion is lost if setup, tab meaning, and next steps are unclear.

Required work:
- finish onboarding walkthrough across all major tabs
- connect the walkthrough to the final account-link action
- confirm post-link refresh and data population are automatic

Acceptance criteria:
- New user can move from empty state to first successful insight without manual explanation

### P2: Next Wave After Beta Stabilization

#### 8. AI-native goals

This is a stronger LEDGR differentiator than copying Copilot's static goals surface.

Ship:
- emergency fund planning from essential spend
- debt payoff scenarios
- monthly contribution recommendations
- forecast vs actual progress

#### 9. Wealth / net worth page

Ship only after core spending and goals are trustworthy.

Ship:
- assets vs liabilities summary
- trend line
- change drivers

#### 10. Manual accounts, tags, and recurring workflows

These are important parity features, but they should not come before:
- transaction trust
- goals clarity
- release quality
- Penny differentiation

## Recommended Execution Order

### Phase 0: Product honesty and launch gate

Time: 2-4 days

Do now:
1. Remove or replace the mobile Goals placeholder
2. Remove unfinished transaction filter placeholders
3. Update beta positioning copy so it matches actual product scope
4. Create release checklist and regression owner

Outcome:
- product stops over-promising

### Phase 1: Trust and core workflow completion

Time: 1-2 weeks

Do next:
1. finish transaction filters
2. ship account deletion and lifecycle cleanup
3. harden connection management
4. add smoke tests for core APIs and manual release checks

Outcome:
- users can trust core money workflows

### Phase 2: Differentiation

Time: 2-3 weeks

Do after Phase 1:
1. upgrade Penny from chat to action-oriented coach
2. connect Penny to real goal creation and follow-up
3. add explainability around recommendations

Outcome:
- LEDGR is meaningfully different, not just smaller than Copilot

### Phase 3: Broader parity expansion

Time: 2-4 weeks

Do later:
1. wealth / net worth page
2. recurring management
3. tags
4. manual accounts / manual transactions
5. widgets and convenience features

Outcome:
- broader market competitiveness

## How LEDGR Can Beat Copilot

Do not try to win on feature count first.

Win on:
- better coaching
- clearer action plans
- better trust and explanation
- faster transaction review
- more privacy-forward posture

### Product thesis

Copilot is strong at showing the money.

LEDGR should be stronger at telling the user what to do next, why it matters, and what changed.

### Concrete opportunities

1. Weekly coaching brief
- "Here are your 3 actions this week."

2. Paycheck-aware recommendations
- tell users what is safe to move after bills and debt minimums

3. Goal autopilot
- not just track goals, but adapt them as spending and balances change

4. Trust layer
- show sync freshness
- show connection health
- show why numbers changed
- show what Penny used to answer

5. Fast financial cleanup loop
- one-tap review
- strong transfer/refund handling
- recategorization that gets better over time

## Non-Goals Right Now

Do not prioritize these before the P0/P1 items:
- broad desktop polish work
- deep investment analytics
- advanced widgets
- social/community features
- heavy customization surfaces

## Proposed First Execution Batch

If this plan is approved, execute in this order:

1. Hide or fully replace mobile Goals tab
2. Finish transaction filter backlog on mobile
3. Implement complete account deletion flow
4. Add release smoke tests and a written test matrix
5. Refactor Penny into guided actions and goal creation flow

## Ship Gate Checklist

Before broader beta, all answers below should be "yes":

- Can a brand-new user sign up and connect without support?
- Are dashboard, categories, transactions, and cash flow numerically consistent?
- Are there no obvious placeholder states in major tabs?
- Can a user safely disconnect and delete their data?
- Does Penny give grounded, useful, non-generic answers?
- Is there a repeatable release verification process?

If any answer is "no," LEDGR is still in private-beta hardening, not true MVP.
