# Friink Account Switcher

`@friink/account-switcher` is the shared, framework-neutral account switcher for Friink products.

Auth maintains the component and remains authoritative for identity, sessions, account activation, account-level logout, and account APIs. The package lives in the repository-level `packages/` directory so current and future applications can consume it without depending on the Accounts app.

## Runtime

The component uses browser-native HTML, CSS, and JavaScript. It has no React, Next.js, or framework runtime dependency.

```html
<account-switcher auth-url="https://auth.example.com" api-base="/auth-api"></account-switcher>
```

Set `variant` to control the presentation without changing the component's
behavior: `button` shows only a dropdown button, `picture` shows the avatar
with a dropdown arrow, `compact` shows the avatar and username, and `full`
shows the name, email, username, and arrow. The default is `full`.

The `auth-url` attribute is the configured Auth origin. `api-base` selects the
same-origin API prefix used by the host application; consuming applications
normally use `/auth-api`, while the Auth app uses its direct `/api/auth` route.

The component renders light-DOM markup so the host application owns all visual
styling. The package does not impose borders, padding, colors, shadows, fixed
menu widths, or viewport-fixed positioning. Hosts should position the menu
relative to the switcher and give it a responsive width appropriate to the
available space.

## JavaScript usage

Framework applications import the package to register the custom element:

```js
import "@friink/account-switcher";
```

The package also exports `publishSessionEvent` for consumers that need to notify other open tabs after an Auth-owned session change.

## Supported behavior

- Loads the current Auth session and available account sessions.
- Activates another account through Auth.
- Starts the add-account login flow with a validated return target.
- Revokes only the selected account session when logging out through the switcher.
- Notifies same-origin tabs through `BroadcastChannel` with a `localStorage` fallback.
- Revalidates the Auth session when a tab becomes visible, receives focus, or returns from the browser back/forward cache.
- Shows an accessible account-change toast and dispatches `friink:active-account-changed` so consuming apps can soft-refresh their own data.

The component does not store credentials, own session state, access the Auth database, or implement product-specific account settings.

## Local package consumption

The current monorepo applications use a file dependency:

```json
"@friink/account-switcher": "file:../packages/account-switcher"
```

The consuming app must include `@friink/account-switcher` in its framework transpilation configuration when required by the framework. Next.js consumers use `transpilePackages`.

## Ownership boundary

Changes to session semantics, Auth endpoints, account activation, logout behavior, or security rules must be made in Auth first. This package should remain a presentation and browser-integration layer over those authoritative APIs.
