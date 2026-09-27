# Session Handling (Retired Unit Note)

**Status:** Deprecated
**Tier:** Minimal
**Last edited:** 2026-09-27T14:18:22Z
**Platforms:** Web
**Canonical source:** [Account Access](../units/account-access.md)

This file is retained for backward links and historical context. It is no
longer a source of product rules. Its session-entry, recovery, failure-case,
and multi-tab behavior has been consolidated into the template-based
[Account Access unit](../units/account-access.md#44-sessions-tokens-refresh-and-logout).

Account lifecycle state and reactivation/deletion-cancellation behavior remain
owned by [Account Lifecycle](../units/account-lifecycle.md); Account Access
documents how lifecycle failures appear during session restoration.

The prior short-form session-handling notes were migrated into Account Access
on 2026-09-27. See its “Session recovery surfaces and route behavior” section,
the related acceptance criteria, and [BUG-AUTH-007](../bugs.md#bug-auth-007--terminal-session-recovery-can-loop-between-public-site-and-app)
for the current routing gap.
