# Error Handling

Error Handling is the cross-product contract for explaining failures and
helping people recover without losing their place. Session recovery is
implemented for the current web entry points; other error categories remain
requirements to refine.

**Status:** Partial  
**Tier:** Full  
**Last edited:** 2026-09-27T17:32:35Z  
**Platforms:** Web, API, and future clients  
**Canonical sources:** This draft; active subsystem behavior remains owned by the relevant unit documents.

---

## Canonical ownership

This document owns shared user-facing error classification, presentation, and
recovery principles across product areas. The session-recovery contract is
active for the listed web routes; other error categories remain draft
requirements. Authentication and session validity remain owned by
[Account Access](./account-access.md); account lifecycle transitions remain
owned by [Account Lifecycle](./account-lifecycle.md). Product units continue
to own domain-specific causes and operations.

## Related units

- [Account Access](./account-access.md) — authoritative session state and
  current route-specific session recovery behavior.
- [Account Lifecycle](./account-lifecycle.md) — deactivation, deletion,
  pending deletion, and reactivation causes.
- [Posts](./posts.md) — post-specific unavailable, validation, and mutation
  failures.
- [Chat](./chat.md) — conversation-specific loading, delivery, and access
  failures.
- [Design System](../design-system.md) — shared modal, loading, and error
  presentation contracts.
- [Business Rules](../rules.md) — only ratified, implemented cross-product
  behavior is recorded as active rules.

---

## 1. Product definition

### Purpose

Give people consistent, understandable failure feedback and a clear next step
while preserving their current context where safe.

### Goals

- Refine one shared error-handling approach across the product.
- Define reusable templates for exactly three error-display types: full-page,
  toast, and modal.
- Keep session recovery in the originating app surface, using the appropriate
  in-app page or modal instead of sending the user through avoidable
  public-site/login route loops.
- Make the correct recovery action depend on whether a failure is technical,
  a confirmed session termination, or an account lifecycle restriction.
- Keep subsystem-specific validation and security decisions authoritative in
  their owning units.
- Keep error presentation and recovery inside the product surface where the
  error occurred: public-site errors stay on the public site, app errors stay
  in the app, and mobile-app errors stay in the native mobile app.

### Scope

- User-facing errors, notices, retry states, and recovery actions.
- Shared error classification and the presentation contract across routes.
- Session-related recovery surfaces across all existing web entry points as
  the first requirements area.
- Requirements refinement, acceptance criteria, and future verification.

### Non-goals

- Changing authentication, session validation, token refresh, or lifecycle
  enforcement as part of this draft.
- Replacing domain-specific API validation or error codes.
- Treating an error message, modal, or client-side state as authorization.
- Opening an iframe or external browser to present an ordinary product error
  or its recovery flow.
- Assuming modal presentation by itself reduces API requests. Request-count
  reduction is a goal to validate separately against the intended flow.

## 2. Users, actors, and permissions

### Actors

- **Visitor or signed-in user:** encounters an unavailable or failed action and
  needs a clear explanation and recovery path.
- **Web client:** maps a known failure category to the approved presentation
  and recovery action without inventing server state.
- **API and product services:** return authoritative domain, authorization,
  lifecycle, and session outcomes.
- **Other open tabs:** may observe shared session recovery and must not expose
  stale authenticated state after a confirmed terminal failure.

### Permissions

- The client may display only actions allowed by the authoritative result and
  the owning product unit.
- Retry may repeat only operations that are safe or explicitly designed for
  idempotent retry.
- The client may not infer successful authentication, session validity, or
  authorization from a displayed message or redirect hint.

### Privacy and security

- Error copy and diagnostics must not expose credentials, tokens, internal
  identifiers, or sensitive account state.
- A recovery modal may overlay the app shell rendered from cached client data.
  Block background interaction while it is active; cached display is not proof
  of session validity and does not authorize protected API actions.
- Ambiguous technical failures must not be presented as confirmed sign-out or
  cause an unrequested account switch.

## 3. Domain model

### Entities

- **Failure event:** an API, browser, or product operation outcome.
- **Failure category:** a user-facing classification that determines what
  explanation and recovery action are appropriate.
- **Recovery surface:** an inline message, modal, full-screen state, or route
  transition used to present the failure.
- **Recovery action:** retry, acknowledge, sign in, choose another account, or
  another domain-owned operation.

### Relationships

Failure category and recovery action depend on the authoritative subsystem
result. The shared presentation contract consumes those results but does not
replace the owning unit's semantics.

### States and transitions

Draft state model for a user-facing failure:

```text
Operation pending → succeeded
Operation pending → failed/ambiguous → explain and offer safe recovery
Operation pending → failed/terminal → explain cause and apply domain recovery
```

The exact shared categories, retry limits, dismissal behavior, and transitions
are not yet ratified.

### Terminology

- **Technical/ambiguous failure:** the available result does not prove that the
  underlying operation or session ended.
- **Terminal session failure:** the authoritative session result confirms that
  the current session cannot continue.
- **Lifecycle restriction:** an account state such as deactivated or pending
  deletion changes which access or reactivation operation is allowed.
- **Modal recovery:** recovery content presented as a dialog while preserving
  the current route context. This does not imply that underlying private
  content remains visible or usable.
- **Product surface:** the public website, the web app, or a native mobile app
  context from which an operation was initiated.
- **Error display type:** one of the three shared presentation templates:
  full-page, toast, or modal. These describe presentation, not severity or
  cause.

## 4. Subunits

### 4.1 Session failure recovery

#### Purpose

Capture the initial shared recovery requirement for session-related errors
across app routes.

#### Scope

This subunit covers presentation and route continuity when session restoration
or session use fails. Account Access remains the authority for session
validity, terminal-versus-ambiguous classification, remembered-account
fallback, and cross-tab acknowledgment.

#### UX and surfaces

**Agreed requirement:** session errors use one of two in-app
presentations. Technical restoration problems use an in-app recovery page while
the app attempts recovery in the background. Confirmed session/lifecycle
failures use an in-app modal. The visitor remains within the originating
product surface; ordinary content errors such as a post that does not exist are
outside this session-error requirement.

Proposed copy and behavior by error:

1. **Technical/ambiguous recovery failure — in-app page.** While recovery is
   being attempted, show: “We’re having trouble reconnecting. We’re trying to
   restore your session.” Show no controls during this attempt. Retry at most
   four times total, with 10 seconds between attempts. A confirmed terminal
   result stops retries immediately. If all four attempts fail ambiguously,
   update the copy to: “We couldn’t restore your session. Use the button below
   to continue.” Show **Take me back**. Continue to the fallback flow below.
2. **Expired or unavailable session — modal.** Message: “Your session is no
   longer active.” Show **Okay** and a close button. Either action acknowledges
   the message and triggers the same fallback flow; clicking outside does not
   close the modal.
3. **Remote logout/termination — modal.** Message: “This session was ended
   from another device.” Show **Okay** and a close button. Either action
   acknowledges the message and triggers the same fallback flow; clicking
   outside does not close the modal.
4. **Security revocation — modal.** Message: “Your session was ended for
   security reasons.” Show **Okay** and a close button. Either action
   acknowledges the message and triggers the same fallback flow; clicking
   outside does not close the modal.
5. **Account deactivation — modal.** Message: “This account was deactivated,
   so this session has ended.” Show **Okay** and a close button. Either action
   acknowledges the message and triggers the same fallback flow; clicking
   outside does not close the modal. Reactivation remains governed by Account
   Lifecycle.
6. **Pending deletion — modal.** Message: “This account is scheduled for
   deletion, so this session has ended.” Show **Okay** and a close button.
   Either action acknowledges the message and triggers the same fallback flow;
   clicking outside does not close the modal. Cancellation/reactivation
   remains governed by Account Lifecycle.

**Fallback flow depends on why the session ended:**

- **Ordinary expiry or unavailable refresh credential:** If another
  API-valid remembered session is available, show an in-app choice modal to
  restore it or go to login. Restoring another session opens Home because the
  original route may not be accessible to that account. If no other session
  can be restored, take the user to login. After sign-in, the login flow
  determines its normal destination.
- **Account deactivation or pending deletion:** The account owner is logged
  out of that account on the initiating client as soon as the lifecycle action
  succeeds. On that client, activate another valid remembered session or go to
  the public site if none is available. Other clients lose access to that
  account's sessions; when they next enter the app, show the cause-specific
  modal, then activate another valid remembered session or go to the public
  site if none is available. Do not send the user to ordinary login for the
  deactivated/deletion-pending account; its lifecycle-owned reactivation or
  deletion-cancellation flow applies if the person later chooses to sign in.

The public-entry redirect hint alone never proves that a session is valid.

The app shell and its available cached view may render beneath a recovery
modal. Keep the modal in front and prevent background interaction while the
user is resolving the error. Cached rendering does not prove a session is
valid or authorize API actions. These are draft copy and interaction
requirements. The listed web session-recovery behavior is implemented locally;
browser acceptance is pending.

#### User flows

##### Session failure while using or entering an app route

**Preconditions:**

- The user is on, or is entering, a protected app route.
- Session restoration/use returns an error that the owning Account Access
  behavior can classify.

**User steps:**

1. The app receives the failure result.
2. The app presents the appropriate recovery page or modal and preserves the
   originating product-surface context.
3. The user follows the presentation-specific flow above: wait during
   background technical recovery, select **Take me back** if recovery remains
   unresolved, or acknowledge a confirmed failure with **Okay**.

**Expected result:**

- The error and next step are understandable without navigating through an
  unnecessary public-site redirect loop.
- No private content remains exposed after confirmed terminal session loss.
- The user remains within the originating public-site, web-app, or native-app
  surface.
- On a confirmed failure, **Okay** or the close button acknowledges the
  message and invokes the fallback for that failure category. Ordinary
  expiry/unavailable-session recovery offers another valid remembered session
  or login, and goes to login if none exists. Deactivation/pending-deletion
  recovery activates another valid remembered session or goes to the public
  site if none exists. Successful account switching opens Home.

**Alternate paths:**

- Technical/ambiguous failures show no controls during background recovery; if
  recovery cannot resolve them, the page copy updates and **Take me back** is
  offered.
- Expiry, remote logout, security revocation, deactivation, and pending
  deletion each show their cause-specific modal with **Okay** and a close
  button. Both trigger the same fallback flow; clicking outside does not close
  the modal.
- Deactivation or pending deletion uses the Account Lifecycle recovery path
  where sign-in requires reactivation or deletion cancellation.

**Error and recovery behavior:**

- Do not create additional restore calls solely because a page transition
  mounted another route guard. Technical retry is limited to four total
  attempts, spaced 10 seconds apart, and only while the result remains
  ambiguous.
- Do not change session validity, token refresh, or lifecycle state through
  presentation-only logic.
- The close button and **Okay** have identical effects. Clicking outside does
  not dismiss the modal. Focus behavior follows the shared design-system
  dialog contract.

#### Business rules

These are proposed requirements, not active rules in `docs/rules.md`.

- **EH-REQ-001 — Keep session recovery in app context:** Technical/ambiguous
  recovery uses an in-app page with background recovery; confirmed
  session/lifecycle failures use an in-app modal. Preserve the originating
  product surface rather than redirecting solely to explain the failure.
- **EH-REQ-002 — Preserve failure meaning:** Presentation must distinguish
  technical/ambiguous failures, confirmed remote/session termination, and
  lifecycle restrictions; recovery actions follow the owning unit's behavior.
- **EH-REQ-003 — Avoid duplicate recovery work:** Route changes introduced only
  to display an error should not cause redundant session/status/restore calls.
  Technical recovery makes at most four total attempts, 10 seconds apart, for
  ambiguous/temporary failures only; a confirmed terminal result stops retries.
- **EH-REQ-006 — Define a restorable session by its refresh credential:** For
  fallback, the app selects another remembered session only when the API
  accepts its refresh credential and associated session/account state. The
  web cookie contains the opaque raw refresh token and is HttpOnly; the API
  stores and compares its SHA-256 hash. The browser does not inspect or validate
  the cookie itself. Without an available, unexpired refresh token, that
  session cannot be restored by issuing a new access or refresh token and is
  not a fallback candidate.
- **EH-REQ-007 — Choose fallback by failure context:** For ordinary expiry or
  an unavailable refresh credential, offer an in-app choice to restore another
  valid remembered session or go to login; if none exists, show login directly.
  For deactivation or pending deletion, log the account out on the initiating
  client and switch to another valid remembered session, or go to the public
  site if none exists. On other clients, show the cause modal before the same
  fallback. Do not route directly to ordinary login for the inactive account.
  After switching accounts, open Home because the original route may not be
  accessible to the selected account.
- **EH-REQ-004 — Keep errors within their originating product surface:** An
  error and its recovery UI stay in the surface where the error occurred:
  public-site errors stay on the public site, web-app errors stay in the app,
  and mobile-app errors stay in the native mobile app. Ordinary error handling
  must not open an iframe or external browser. No exception is currently
  specified. This is a proposed cross-product boundary, not an active rule.
- **EH-REQ-008 — Use the same session-recovery flow across web entry points:**
  Session failures from the public root, app-shell, profile, post,
  username-chat, and login entry points use the same cause classification and
  fallback policy while respecting EH-REQ-004's surface boundary. A public-site
  failure stays on the public site; app recovery does not hand off to an
  external browser or another product surface.
#### State behavior

- **Pending:** show a non-blocking or blocking progress state only as the
  originating operation requires; exact shared behavior is open.
- **Ambiguous/technical:** preserve identity and explain the uncertainty. Run
  background recovery without controls first; if unresolved, update the copy
  and offer **Take me back**.
- **Confirmed terminal:** explain the cause; do not expose private content;
  follow Account Access acknowledgment and fallback behavior.
- **No usable refresh token:** treat that remembered session as unrestorable;
  do not attempt to mint another access or refresh token for it. Offer another
  valid remembered session or login according to the fallback flow.
- **Lifecycle restricted:** explain the deactivation or pending-deletion cause
  and route to the lifecycle-owned action.
- **Recovery unavailable:** preserve enough context for a later retry and do
  not silently switch accounts.

#### Data requirements

The initial requirement creates no new persistent data. Any displayed error
category must be derived from an authoritative result or a safe client-side
classification that is defined by the owning unit.

#### API and service contract

No API changes are specified. Existing response codes and categories remain
owned by Account Access, Account Lifecycle, and the affected product units.

#### Frontend contract

- Keep the route context during modal presentation where safe.
- Prevent background interaction while a blocking recovery modal is active.
- Meet keyboard, focus, accessible-name, and focus-return expectations defined
  by the shared design system once the modal contract is finalized.
- Avoid duplicate requests caused by mounting an alternate error route.

#### Backend contract

No backend contract changes are proposed. The server remains authoritative for
authentication, authorization, account lifecycle, and operation outcomes.

#### External integrations

Not applicable to the initial requirement. Email and other recovery
integrations remain owned by the relevant product unit.

#### Acceptance criteria

Implementation is present locally; these criteria remain unchecked until
browser acceptance is completed.

- [ ] **EH-AC-001** A session failure on each in-scope app route is presented
  using the specified in-app recovery page or modal, while preserving product
  surface context.
- [ ] **EH-AC-002** The app shell can render from cached client data behind a
  recovery modal, with background interaction disabled; cached rendering does
  not imply a valid session or authorize API actions.
- [ ] **EH-AC-003** Technical, terminal-session, and lifecycle failures present
  distinct explanations and domain-appropriate recovery actions.
- [ ] **EH-AC-004** Showing the recovery page or modal does not cause duplicate
  status or restore calls solely due to navigation to an error route.
- [ ] **EH-AC-005** Error presentation and recovery remain within the originating
  public-site, web-app, or native mobile surface, without opening an iframe or
  external browser for ordinary error handling.
- [ ] **EH-AC-008** Technical recovery initially runs without controls, makes
  at most four total attempts 10 seconds apart for ambiguous failures, stops
  immediately on a confirmed terminal result, then updates copy and offers
  **Take me back** if all attempts fail.
- [ ] **EH-AC-009** Expiry, remote termination, security revocation,
  deactivation, and pending deletion each show a cause-specific modal with
  **Okay** and a close button; either action starts the same fallback flow and
  clicking outside does not dismiss it.
- [ ] **EH-AC-010** A remembered session is restorable only while its refresh
  token is present, unexpired, and accepted with the associated session/account
  state by the API.
- [ ] **EH-AC-011** For ordinary expiry/unavailable-session failures, offer
  restore or login when another API-valid remembered session exists, and
  otherwise show login. Deactivation/pending deletion instead switches to
  another valid remembered session or goes to the public site when none exists,
  including on the initiating client. Switching accounts opens Home.
- [ ] **EH-AC-012** Session-error recovery is consistent across the public
  root, app-shell, profile, post, username-chat, and login entry points while
  staying within each entry point's product surface.

#### Test scenarios

Refer to [`testing.md`](../testing.md) for shared testing standards.

- [ ] Technical restoration initially runs without controls, retries no more
  than four times at 10-second intervals, and then changes copy and reveals
  **Take me back** if all attempts remain unresolved.
- [ ] Each confirmed expiry, remote termination, security, deactivation, and
  pending-deletion cause shows its specified modal; **Okay** and close have
  identical outcomes, and backdrop clicks do not dismiss it.
- [ ] After ordinary expiry/unavailable-session recovery, the app offers
  restore or login when another API-valid remembered session exists, and
  otherwise shows login. After deactivation/pending-deletion recovery, it
  switches to another valid remembered session or goes to the public site if
  none exists. Switching accounts opens Home.
- [ ] Ambiguous failures remain retryable and do not clear or switch identity.
- [ ] Remote logout and other terminal failures acknowledge then follow
  remembered-account fallback.
- [ ] A remembered fallback is selected only when its unexpired refresh token
  and associated session/account state are accepted by the API.
- [ ] Deactivated and pending-deletion accounts show the correct lifecycle
  explanation and recovery path.
- [ ] Modal keyboard, focus, close/Okay equivalence, backdrop behavior, and
  background privacy are verified.
- [ ] API/status/restore request counts are checked for duplicate calls.
- [ ] Public-site, web-app, and mobile-app errors do not escape into another
  surface unless a separately specified handoff applies.

#### Verification

- [ ] Requirements and route scope approved.
- [ ] Acceptance criteria checked manually or by an existing test.
- [ ] Relevant error and permission states checked.
- [ ] No known contradiction with related units.

#### Known limitations

- Browser and staging acceptance remain pending for retry timing, modal
  behavior, account restoration, lifecycle fallback, and cross-tab convergence.
  The implementation does not claim that modal presentation reduces API calls.
- Error handling outside session recovery remains a requirements area; the
  shared full-page, toast, and modal templates are not yet generalized across
  product units.
- See [BUG-AUTH-007](../bugs.md#bug-auth-007--terminal-session-recovery-can-loop-between-public-site-and-app)
  for the reported public-entry loop; the exact reported browser state remains
  unverified.

#### Open questions

- Error handling outside session recovery is deferred; it is not needed to
  implement the session-recovery requirements.

### 4.2 Shared error-display templates

#### Purpose

Define the three reusable display patterns available to future error flows.

#### Scope

This subunit defines template structure only. The severity and context rules
that select a template are not yet decided. Error causes and recovery actions
remain owned by the affected product unit.

#### UX and surfaces

The shared error-display types are exactly:

##### Full-page error template

- **Title:** short description of what failed.
- **Explanation:** concise cause or limitation that is safe to disclose.
- **Primary action:** the recommended next step, when one exists.
- **Secondary action:** optional alternative, such as retry or return to a
  safe location.
- **Surface behavior:** replaces the current page content while remaining in
  the originating public-site, web-app, or native-app surface.

##### Toast template

- **Message:** brief result or failure description.
- **Optional action:** one concise action if the result can be addressed
  without opening a separate error surface.
- **Surface behavior:** transient feedback within the originating surface;
  duration, persistence, and stacking rules remain open.

##### Modal error template

- **Title:** short description of the issue.
- **Explanation:** cause and relevant consequence in plain language.
- **Actions:** primary recovery action and optional secondary action; required
  acknowledgment and dismissal behavior depend on the owning flow.
- **Surface behavior:** overlays the current route and keeps recovery within
  the originating public-site, web-app, or native-app surface. When private
  content is no longer safe to show, the background must be masked or replaced
  by a safe shell.

No fourth shared error-display template is currently in scope. Form-field
validation remains part of the relevant form contract rather than a fourth
global error surface.

#### User flows

##### Display an error using one shared template

**Preconditions:**

- An owning product unit has determined the error cause and safe recovery
  action.
- A display type has been selected under future-approved selection criteria.

**User steps:**

1. The product surface receives or derives an error result.
2. It renders that result with one of the three shared templates.
3. The user reads the message and takes an available action, if needed.

**Expected result:**

- The message uses a consistent type-specific structure.
- The user remains in the originating product surface.
- The owning unit's error meaning and recovery operation are preserved.

**Alternate paths:**

- A non-blocking result may use a toast if future selection rules allow it.
- A failure that replaces the current task may use a full-page template if
  future selection rules allow it.
- A failure requiring attention or a choice may use a modal if future
  selection rules allow it.

**Error and recovery behavior:**

- Do not select a presentation type in a way that hides a security-relevant
  cause or exposes content that should be masked.
- Do not open an iframe or external browser for ordinary error presentation.
- Keep display-type selection criteria marked as draft until approved.

#### Business rules

- **EH-REQ-005 — Use only three shared error-display templates:** Shared error
  presentation templates are limited to full-page, toast, and modal. The
  criteria for choosing among them remain to be refined. This does not replace
  control-specific field validation owned by a form or product unit. The three
  template definitions in this section are the complete shared set for this
  draft.

#### State behavior

- **Full-page:** occupies the current surface's main content area; exact retry,
  back, and dismissal behaviors are selected by its owning flow.
- **Toast:** briefly reports an outcome without replacing the current route;
  timing and user dismissal remain open.
- **Modal:** overlays current context and must block unsafe background
  interaction where the recovery requires attention; safe-background rules
  apply after access is lost.

#### Data requirements

Templates render safe presentation data only: a user-facing title, explanation,
and allowed actions. No template adds persistent data.

#### API and service contract

No shared API schema is defined. Owning units map authoritative outcomes to
safe display content and actions.

#### Frontend contract

Use only the full-page, toast, or modal shared template for global error
presentation. Preserve product-surface context. Meet the shared accessibility
contract for the chosen component; detailed modal/toast/full-page design tokens
remain owned by the Design System.

#### Backend contract

No backend changes are specified. The server remains the source of truth for
error causes and permitted operations.

#### External integrations

Not applicable.

#### Acceptance criteria

- [ ] **EH-AC-006** The shared error-handling catalog contains templates for
  full-page, toast, and modal only; form-field validation remains owned by the
  relevant form and is not added as a fourth global template.
- [ ] **EH-AC-007** Each template presents the message and allowed actions
  within the originating product surface.

#### Test scenarios

- [ ] Verify each template's content slots and actions render correctly.
- [ ] Verify all three templates preserve public-site, web-app, and native-app
  context.
- [ ] Verify no global error display type outside the three-template set is
  introduced without revising this requirement.

#### Verification

- [ ] Template inventory remains exactly three shared types.
- [ ] Template usage follows approved selection criteria once defined.
- [ ] Surface and accessibility behavior matches the Design System.

#### Known limitations

Selection criteria, toast timing, modal dismissal, and full-page recovery
navigation remain unspecified outside the explicit session-recovery flows above.

#### Open questions

- What conditions choose full-page, toast, or modal?
- Which errors are dismissible, persistent, or require acknowledgment?
- What toast lifetime and queue behavior are appropriate?
- When should a full-page error provide retry versus return/back actions?

## 5. Cross-subunit behavior

Only session recovery is initially drafted. Future error categories should use
the same shared presentation principles where applicable while retaining
their subsystem-specific semantics and safe recovery operations.

## 6. Cross-unit dependencies

- Consumes authoritative session outcomes, restore order, and cross-tab
  acknowledgment from Account Access.
- Consumes lifecycle causes and reactivation/deletion-cancellation behavior
  from Account Lifecycle.
- Provides shared presentation and recovery requirements to product units
  after the relevant requirements are approved and implemented.
- Must remain compatible with the shared dialog and accessibility contracts in
  the Design System.

## 7. Technical architecture

### Components and ownership

Session recovery is implemented across `web/lib/session-recovery.ts`,
`web/components/session-recovery-screen.tsx`,
`web/components/app-shell-route.tsx`,
`web/components/public-route-guard.tsx`, route-specific clients,
`web/components/account-screens.tsx`, and `web/app/login/login-client.tsx`.
The existing auth/session APIs remain authoritative for credential validation;
the retry helper and presentation layer do not change token rules.

### Storage and persistence

No new storage or persistence is specified.

### Events and notifications

No new events or notifications are specified. Security and lifecycle events
remain owned by their respective units.

### Performance and reliability

The motivating request is to reduce navigation churn and unnecessary recovery
calls. The modal requirement can reduce route transitions, but the actual call
count impact must be measured; it is not assumed.

### Observability

No new logging is specified. Diagnostics must not contain secrets, tokens,
cookies, or sensitive account values.

## 8. Testing and verification

### Traceability matrix

| ID | Requirement or rule | Test or verification | Status |
|---|---|---|---|
| EH-REQ-001 | Keep session recovery in app context | Route-by-route browser flow | Implemented locally; acceptance pending |
| EH-REQ-002 | Preserve failure meaning | Technical/terminal/lifecycle failure matrix | Implemented locally; acceptance pending |
| EH-REQ-003 | Avoid duplicate recovery work | Network request-count comparison | Verification pending |
| EH-REQ-004 | Keep errors within their originating product surface | Public/web/mobile surface routing matrix | Draft |
| EH-REQ-006 | Restore only an API-accepted session credential/state | Refresh-cookie and account-slot recovery matrix | Implemented locally; acceptance pending |
| EH-REQ-007 | Fallback destination follows failure context | Session and lifecycle destination matrix | Implemented locally; acceptance pending |
| EH-REQ-008 | Use consistent session recovery across web entry points | Web-entry recovery matrix | Implemented locally; acceptance pending |
| EH-AC-001 | In-app page/modal presentation by session failure state | Browser route matrix | Implemented locally; acceptance pending |
| EH-AC-002 | Cached app view may remain behind blocked recovery modal | Browser privacy/accessibility check | Planned |
| EH-AC-003 | Distinct cause-specific recovery | Failure-category matrix | Implemented locally; acceptance pending |
| EH-AC-004 | No error-route-induced duplicate calls | Browser network trace | Planned |
| EH-AC-005 | Error/recovery stays in originating product surface | Web and mobile route/surface matrix | Planned |
| EH-REQ-005 | Use only three shared error-display templates | Template inventory review | Draft |
| EH-AC-006 | Template catalog has exactly three shared types | Documentation/component inventory review | Planned |
| EH-AC-007 | Templates preserve originating product surface | Public/web/mobile surface matrix | Planned |
| EH-AC-008 | Background recovery and Take me back behavior | Recovery success/failure and remembered-session browser matrix | Implemented locally; acceptance pending |
| EH-AC-009 | Cause-specific modal with equivalent Okay/close acknowledgment | Expiry/termination/security/lifecycle browser matrix | Implemented locally; acceptance pending |
| EH-AC-010 | Fallback session is API-validated | Refresh-cookie and account-slot recovery matrix | Implemented locally; acceptance pending |
| EH-AC-011 | Fallback destination follows failure context | Session and lifecycle destination matrix | Implemented locally; acceptance pending |

### Test matrix

| Area | Scenario | Expected result | Verification |
|---|---|---|---|
| UX | Technical session recovery | In-app page runs recovery without controls, then offers Take me back if unresolved | Browser |
| UX | Expiry, remote termination, security revocation | Correct cause message; Okay and close run the same flow; backdrop does not dismiss | Browser |
| UX | Deactivation or pending deletion | Correct lifecycle message; Okay and close run the same flow; backdrop does not dismiss | Browser |
| Fallback | Ordinary expiry/unavailable credential | Offer restore or login when another valid session exists; otherwise login | Browser/API |
| Lifecycle | Deactivation/pending deletion on initiating client | Log out immediately; switch to another valid session or go public | Browser/API |
| Lifecycle | Deactivation/pending deletion observed on another client | Explain cause, acknowledge, then switch to another valid session or go public | Browser/API |
| Routing | Recovery from public root, profile, post, username chat, login, and app-shell routes | Same cause classification and fallback policy without leaving originating surface | Browser |
| Reliability | Error presentation across route changes | No duplicate status/restore call caused by error routing | Network trace |
| Accessibility | Open, use, and resolve modal with keyboard | Focus and dialog semantics remain correct | Manual |
| Surface boundary | Trigger errors from public, web-app, and mobile contexts | Recovery remains within originating surface without external-browser handoff | Browser/device |
| Template inventory | Full-page, toast, modal presentations | Correct structure and no fourth shared template | Component/documentation review |

### Release gates

Requirements must be approved, route scope and safe background behavior must
be defined, and the owning units' existing authentication and lifecycle
contracts must remain intact. No release gate is active while this document is
only a draft.

### Manual verification

Once implemented, verify each in-scope route in technical, terminal, and
lifecycle failure states; confirm route continuity, safe content masking,
keyboard access, focus behavior, and actual request counts.

## 9. Deployment and migration

No deployment or data migration is specified. Any future rollout should be
limited to the web presentation/routing scope approved for the change and
verified in staging before production.

## 10. Current implementation status

The web session-recovery behavior described in this unit is implemented
locally across the public guard, app shell, profile/post/chat route clients,
login route, and lifecycle actions. Browser and staging acceptance remain
pending. Shared error templates and non-session error categories remain
unimplemented. AUTH-R-008 records the active web session and refresh contract;
the recovery UX does not change its token or server-validation rules.

## 11. Rebuild checklist

- [ ] Product behavior implemented
- [ ] Business rules approved and enforced
- [ ] UX surfaces and states implemented
- [ ] API and service contracts reviewed; no changes currently specified
- [ ] Data model and persistence reviewed; no changes currently specified
- [ ] Permissions and privacy verified
- [ ] Integrations reviewed; no changes currently specified
- [ ] Automated tests passing
- [ ] Manual verification complete
- [ ] Deployment and migration complete, if applicable

## Changelog

The repository [`CHANGELOG.md`](../../CHANGELOG.md) is authoritative for
project-wide history. This section records requirements added to this unit.

- 2026-09-27T14:43:07Z — Created the draft unit and recorded the initial
  user-proposed session recovery modal requirement. No implementation behavior
  changed.
- 2026-09-27T14:48:53Z — Added the proposed core boundary that errors and
  recovery remain within the originating public-site, web-app, or native
  mobile surface, with ordinary errors not opening iframes or external
  browsers. No implementation behavior changed.
- 2026-09-27T14:52:22Z — Defined full-page, toast, and modal as the only shared
  error-display types and added a draft template for each. Selection criteria
  remain open; no implementation behavior changed.
- 2026-09-27T15:04:42Z — Added the six-case session presentation matrix and
  proposed copy: technical failures use background recovery then “Take me
  back”; confirmed session/lifecycle failures use acknowledgment modals and
  let the app choose the next state. Added open UX decisions; no behavior
  changed.
- 2026-09-27T15:43:26Z — Recorded the preferred fallback order and cached-shell
  behavior, clarified that the API validates the opaque refresh cookie against
  its stored SHA-256 hash and session/account state, and proposed up to four
  total attempts on ambiguous failures only; the retry count was subsequently
  confirmed at 10-second intervals.
- 2026-09-27T16:07:42Z — Confirmed four recovery attempts at 10-second
  intervals; defined missing/expired refresh credentials as unrestorable;
  specified Home after account switching, the restore-or-login choice, modal
  close/Okay equivalence, consistent web entry-point coverage, and the
  originating-surface boundary. Requirements only; no auth or application
  behavior changed.
- 2026-09-27T16:13:24Z — Clarified that the restore-or-login choice is an
  intentional UX enhancement to the current behavior recorded in AUTH-R-008;
  update that active rule when the enhancement is implemented. No behavior
  changed.
- 2026-09-27T16:30:31Z — Distinguished ordinary expiry recovery from
  deactivation/pending-deletion recovery: lifecycle actions immediately end the
  initiating account session and route to another valid session or public;
  other clients see the cause before the same fallback. Login remains the
  ordinary expiry fallback. No application behavior changed.
- 2026-09-27T17:32:35Z — Implemented web session recovery with four spaced
  attempts for ambiguous failures, cause-specific modals, explicit
  restore-or-login for ordinary expiry, lifecycle fallback to another valid
  session or public, and Home after account switching. Server auth and token
  behavior were unchanged; browser acceptance remains pending.
