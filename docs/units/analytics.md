# Analytics

Friink's browser-side product analytics integration records lightweight UX
usage through Mixpanel. It is intentionally independent of the API and does
not collect application content or authentication secrets.

**Status:** Active  
**Tier:** Minimal  
**Last edited:** 2026-10-14  
**Platforms:** Web  
**Canonical sources:** [`web/lib/analytics.ts`](../../web/lib/analytics.ts), [`web/components/analytics-provider.tsx`](../../web/components/analytics-provider.tsx), [`web/app/layout.tsx`](../../web/app/layout.tsx)

---

## Canonical ownership

This document owns the web analytics initialization, identity handoff, and
page-view behavior. It does not own product event definitions for individual
features, backend observability, or subscription and security reporting.

## Related units

- [Account Access](./account-access.md) — supplies the active account identity
  and session-expiry lifecycle.
- [Navigation](./navigation.md) — owns route and navigation behavior measured
  by page views.
- [Settings](./settings.md) — owns user privacy and account controls.

## Product definition

### Purpose

Provide a small, non-blocking UX signal for understanding which Friink web
surfaces are visited and which authenticated account is active.

### Scope

- Browser-side Mixpanel initialization when `NEXT_PUBLIC_MIXPANEL_TOKEN` is
  configured.
- Route-level `Page Viewed` events using the current pathname.
- Identification with the stable authenticated user ID.
- Reset on session expiry or logout.

### Non-goals

- Server-side event delivery.
- Session replay or broad autocapture.
- Sending email, profile text, private messages, auth tokens, or passwords.

## Rules

- **ANALYTICS-R-001:** Missing Mixpanel configuration disables analytics
  without affecting application rendering or navigation.
- **ANALYTICS-R-002:** The web client uses the Mixpanel Project Token through
  `NEXT_PUBLIC_MIXPANEL_TOKEN`; no Mixpanel secret belongs in the browser.
- **ANALYTICS-R-003:** Authenticated identity uses `AuthUser.id`; account
  changes identify the newly active account and session expiry resets the
  analytics identity.
- **ANALYTICS-R-004:** Analytics initialization and delivery are non-blocking,
  and broad autocapture is disabled.

## Frontend contract

`AnalyticsProvider` is mounted in the root web layout. It subscribes to the
existing session-change channel, initializes only in the browser, and tracks
pathname changes as `Page Viewed` with a `path` property.

## External integration

Mixpanel's browser SDK is installed as `mixpanel-browser`. Production receives
the token through the web Vercel project's Production environment. Development
and staging should use separate Mixpanel projects or remain disabled until
their tokens are configured.

## Acceptance criteria

- [ ] **ANALYTICS-AC-001** The web app renders normally when the token is empty.
- [ ] **ANALYTICS-AC-002** A configured token produces one `Page Viewed` event
  for each pathname change.
- [ ] **ANALYTICS-AC-003** Login/session restoration identifies the active
  account by stable user ID, and expiry resets it.
- [ ] **ANALYTICS-AC-004** No auth secrets or user-generated content are sent by
  the integration.

## Verification

- Type-check the web project after the integration changes.
- Verify the empty-token path locally.
- With a non-production Mixpanel token, confirm a route event and identity
  change in Mixpanel's live event view before production release.

## Known limitations

Feature-specific interaction events are not yet instrumented. This unit
currently provides route views and identity lifecycle only.
