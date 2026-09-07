# Deferred tests

## Account-switcher cookie-clearing scenario

- Status: Deferred.
- Observation: remembered accounts disappeared after browser cookies were
  cleared and the browser was restarted.
- Expected behavior: account slots are bound to the browser's device and slot
  cookies; clearing cookies creates a new device identity, so prior accounts
  are no longer listed.
- Follow-up test: restart Chrome without clearing cookies and confirm the
  remembered accounts remain; then separately confirm that clearing cookies
  intentionally starts with an empty switcher.
- Release decision: skip this scenario for the current account-switcher
  activity and revisit it in a later test pass.
