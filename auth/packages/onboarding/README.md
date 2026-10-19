# Friink Onboarding

`@friink/onboarding` is the Auth-maintained, framework-neutral onboarding UI for Friink products.

It is a browser-native custom element built with HTML, CSS, and JavaScript:

```html
<friink-onboarding
  auth-url="https://auth.example.com"
  session-url="/auth-api/get-session"
  complete-url="/onboarding-api/complete">
</friink-onboarding>
```

The component owns presentation and browser flow only. Auth owns the user record, onboarding status, username validation, completion API, and session authority. It does not store credentials or implement security policy.

## Integration

Framework applications import the package to register the element:

```js
import "@friink/onboarding";
```

`session-url` and `complete-url` should normally point to the consuming app's configurable Auth proxy. The Auth-hosted fallback uses `/api/auth/get-session` and `/api/onboarding/complete` directly. `auth-url` is used only to redirect an unauthenticated visitor to Auth.

The package is intentionally independent of React and Next.js. Native mobile clients should use native UI and the Auth mobile API contract rather than embedding this web component.
