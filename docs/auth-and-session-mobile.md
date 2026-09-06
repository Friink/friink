# Friink Authentication and Session — Mobile Requirements

**Status:** Deferred until a mobile client exists

This document contains only requirements that are specific to a native mobile
client or to backend behavior needed exclusively to support mobile. It does not
duplicate the shared authentication, session, lifecycle, security, or account
switching contract in [`auth-and-session.md`](auth-and-session.md).

The current release focus is the web application. These requirements remain
preserved and become an implementation and acceptance gate when iOS or Android
development begins.

## 1. Ownership boundary

The mobile client must use the same server authentication authority and the
same account/session semantics as the web client. Mobile must not introduce a
parallel password, OTP, lifecycle, refresh, or account identity model.

The shared document remains authoritative for:

- signup and login steps, including the single signup OTP and alternative
  login approval path;
- refresh rotation, session revocation, lifecycle states, and security events;
- account-slot limits, opaque slot references, safe account summaries, and
  account isolation;
- password policy, recovery policy, rate limits, and staff/security rules.

## 2. Mobile credential boundary

Each remembered account slot must have one isolated credential entry in the
platform's protected storage: iOS Keychain, Android Keystore-backed secure
storage, or an equivalent reviewed facility.

The mobile app must:

- keep access tokens in memory where practical and never log tokens;
- never place refresh credentials, token hashes, passwords, OTPs, device
  secrets, or internal UUIDs in ordinary preferences, analytics, crash reports,
  deep-link parameters, or clipboard contents;
- bind stored credentials to the server-issued opaque account slot and never
  select an account by trusting a client-supplied user ID;
- delete the slot credential after confirmed removal, logout, revocation, or
  account lifecycle termination, while preserving unrelated account slots;
- treat a failed or ambiguous network request as recoverable and preserve the
  previously active account until the server confirms a terminal result.

## 3. Mobile account switcher

The mobile account switcher follows the shared account model but uses mobile
navigation patterns appropriate to the product shell. It must provide:

- the active account first, with safe profile summary data only;
- access to Add account, account switching, Manage accounts, and active logout;
- the same most-recent-account fallback after logout or removal;
- an atomic active-account change so feed, notifications, drafts, uploads,
  chats, and settings cannot briefly display data from the previous account;
- a loading state during switch and a recoverable error state that leaves the
  previous account usable;
- re-authenticate/remove actions for an expired or revoked slot without
  affecting other remembered accounts.

The mobile client must not silently replace an account when the server limit is
reached. It must explain that an existing account must be removed first.

## 4. App lifecycle and recovery

Mobile-specific session handling must be tested across:

- cold start, warm start, foreground/background transitions, force-close, and
  device restart;
- temporary offline mode, API outage, timeout, VPN change, and recovered
  connectivity;
- access-token expiry while foregrounded and while backgrounded;
- concurrent refresh attempts from app lifecycle callbacks;
- biometric/device-lock interruptions where the platform secure-storage API
  requires user presence;
- an account switch during an in-flight request or notification update.

A background transition must not revoke a valid account merely because the app
  cannot run immediately. On resume, the app must recover each account slot
  independently and surface only a confirmed terminal failure.

## 5. Mobile authentication surfaces

The mobile login and signup screens reuse the shared server flows and the
approved web semantics. Mobile-specific work is limited to adapting those
flows to native navigation, keyboard, focus, screen-reader, and interruption
behavior.

The mobile client must preserve these boundaries:

- signup email → OTP → password/profile remains one path;
- existing-session approval and emailed OTP remain alternative verification
  methods, never sequential checks;
- approval requests never display the email OTP in an existing session;
- app suspension, notification dismissal, rotation, or navigation must not
  create a second OTP request or lose a valid pending challenge without a
  recoverable way back;
- sensitive values are cleared from transient UI state after completion or
  cancellation.

## 6. Mobile notifications and deep links

Mobile security and account notifications must open the correct account
context without treating a push payload or deep link as authentication. A
notification may identify a safe action, but the app must retrieve protected
details from the API after authenticating the selected account slot.

Approval actions must show the account and coarse device details defined by the
shared contract, require an authenticated existing session, and handle expiry,
denial, revocation, and duplicate taps idempotently.

## 7. Mobile accessibility and acceptance gate

Before mobile support is released, test at minimum:

- VoiceOver and TalkBack labels, focus order, dynamic text, contrast, and
  reduced-motion behavior;
- keyboard and one-handed interaction for login, signup, OTP, account
  switching, removal, and lifecycle screens;
- loading, empty, offline, retry, expired-session, revoked-slot, and API-error
  states;
- two independent accounts through app restart, background/foreground, switch,
  logout, removal, concurrent refresh, and notification handling;
- secure-storage isolation and cleanup on supported iOS and Android versions;
- no cross-account cache, draft, upload, notification, or analytics leakage.

Evidence must identify the device/OS, app build, account-slot operation, and
result. Mobile remains deferred until a client, platform secure-storage
implementation, and this acceptance evidence exist.
