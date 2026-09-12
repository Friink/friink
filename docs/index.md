# Friink Documentation

This directory contains feature contracts, architecture notes, operational
guides, decision records, and verification evidence. Start with the document
that matches the kind of question you are answering.

## Source-of-truth map

| Need | Source | Owns |
| --- | --- | --- |
| Active business rules | [`RULES.md`](../RULES.md) | Product, privacy, authorization, and platform behavior |
| Visual and component rules | [`packages/design/design.md`](../packages/design/design.md) | Layout, tokens, interaction presentation, and reusable UI contracts |
| Feature behavior | Feature contract in this directory | End-to-end product behavior and acceptance criteria |
| Architecture | Architecture document in this directory | System boundaries, data flow, and technical design |
| Verification evidence | Verification/audit document in this directory | Test results, staging evidence, and known limitations |
| History | [`CHANGELOG.md`](../CHANGELOG.md), [`AGENTLOG.md`](../AGENTLOG.md) | What changed and when; not the current product contract |

When documents conflict, prefer the most specific active contract, then
`RULES.md` for business behavior and `packages/design/design.md` for visual
behavior. Historical logs explain how a decision changed but do not override an
active contract.

## Feature contracts

- [`posts.md`](posts.md) — posts, nested replies, reply permalinks, reactions,
  visibility, and Quotes.
- [`chat-behavior.md`](chat-behavior.md) — chat requests, conversations,
  composer states, notifications, mute/archive, and blocking boundaries.
- [`notifications.md`](notifications.md) — notification surfaces, read state,
  polling, privacy, and acceptance checks.
- [`like-and-star.md`](like-and-star.md) — Likes, Saves, actor visibility,
  notifications, and reaction API behavior.
- [`account-lifecycle.md`](account-lifecycle.md) — deactivation, deletion,
  reactivation, and lifecycle timing.
- [`account-switcher.md`](account-switcher.md) — remembered accounts, device
  slots, switching behavior, rollout notes, and verification history.
- [`subscriptions.md`](subscriptions.md) — subscription plans, entitlements,
  administration, and future billing boundaries.
- [`updated-account-info.md`](updated-account-info.md) — Joined, Region,
  Location, and onboarding account information.
- [`blocking.md`](blocking.md) — blocking behavior and blocked-profile surfaces.
- [`read-receipts.md`](read-receipts.md) — chat read-state and receipt behavior.

## Authentication and session

- [`auth-and-session.md`](auth-and-session.md) — full authentication/session
  architecture and implementation boundary.
- [`auth-and-session-mobile.md`](auth-and-session-mobile.md) — mobile-only
  requirements, deferred until a native client exists.
- [`auth-and-session-progress.md`](auth-and-session-progress.md) — dated audit
  and staging reconciliation.
- [`progressive-login.md`](progressive-login.md) — progressive login contract,
  decisions, risks, and verification matrix.
- [`login.md`](login.md) — focused login incident notes.
- [`failed-login-policy.md`](failed-login-policy.md) — failed-login throttling
  and notification policy.
- [`forget-password.md`](forget-password.md) — password recovery contract.
- [`auth-incident-response.md`](auth-incident-response.md) — operator runbook
  for authentication and session incidents.

## Media, performance, and testing

- [`media-upload.md`](media-upload.md) — post/profile media architecture and
  verification notes.
- [`latency.md`](latency.md) — latency investigation and measurements.
- [`tests.md`](tests.md) — deferred or environment-blocked test scenarios.

The `session/` subdirectory contains deeper session and media architecture
audits, design notes, and handoff records.

## How to add documentation

Prefer updating an existing feature contract over creating a new note. Create a
new document only when the subject has a distinct owner or lifecycle. Keep
historical investigation and verification evidence separate from the active
contract whenever the file would otherwise become difficult to scan.
