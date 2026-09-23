# Friink Design System

Friink is a calm, people-first social space centered on meaningful
conversation, trust, and professional discovery. This document defines the
product-level design language that should remain consistent across the public
site, authentication flows, and signed-in application.

**Status:** Active  
**Last edited:** 2026-09-23T01:35:00Z
**Implementation contract:** [`packages/design/design.md`](../packages/design/design.md)  
**Token source:** [`web/theme.config.ts`](../web/theme.config.ts)  
**Shared styling source:** [`web/app/globals.css`](../web/app/globals.css)

## Design principles

- **Calm and human:** The interface should feel safe, clear, and quietly
  premium rather than loud or overly technical.
- **People first:** Identity, authorship, and human relationships should be
  easy to understand wherever they appear.
- **Clear over clever:** Controls, labels, states, and navigation should be
  immediately understandable.
- **Consistent without being rigid:** Shared patterns should feel familiar,
  while contextual content may remain specialized when it needs to.
- **Trust through feedback:** Every meaningful action should communicate its
  progress, result, failure, or next step.
- **Respectful by default:** Privacy, safety, accessibility, and recovery
  behavior are part of the experience rather than afterthoughts.

## Brand character

The visual language uses soft natural neutrals, a restrained green brand
accent, friendly typography, circular people imagery, and quiet separation
through thin lines. The product should feel welcoming and trustworthy without
becoming playful at the expense of clarity.

## Brand assets

- Use the canonical logo assets in `brand/` and their synchronized web copies
  in `web/public/brand/`.
- Use mark assets for compact identity surfaces and full lockups for headers,
  authentication, lifecycle, and other branded wordmark surfaces.
- Choose black or white variants for public light/dark surfaces and the
  brand-color variant for authenticated application surfaces.
- Keep logo alignment in the consuming layout; do not add legacy viewbox
  padding or compensate by distorting the asset.

Exact asset dimensions and optical sizes are maintained in the implementation
contract rather than repeated here.

## Visual foundations

### Color

- The primary brand color is green and is used for active states, selected
  tabs, important links, primary actions, indicators, and focus treatment.
- Scrollable tab strips hide the right scroll affordance at the end of the
  strip, and their arrow controls remain contained within the tab-bar height
  and flush with the strip edges.
- Selected tabs use the user-configurable accent color for both text and the
  smoothly moving active-tab underline. The shared tab container also renders
  a subtle full-width bottom rule, but selected tabs have no background fill.
- Post actions use the current accent color on hover, keyboard focus, and
  press; persistent Like and Save states also retain the accent color.
- Signup password and username guidance uses full-width left alignment;
  satisfied password requirements and a valid username rule use the current
  accent color.
- Profile connection actions that include a label use the standard text-button
  layout; icon-only Message and More controls retain `.icon-button` geometry.
- Search-route refinement uses a funnel icon between the query field and the
  contextual ActionMenu. The funnel opens one shared modal that groups sorting
  and date filtering. Applying changes URL-backed state, reloads results, and
  shows an accent indicator while a non-default refinement is active.
- Chat list rows show the participant's avatar and display name once. The
  full ProfileCard remains together on the left. The flexible middle column
  shows a two-line latest message preview with ellipsis truncation, then the
  relative date and unread/receipt state. Muted and Archived are reserved for
  their dedicated tabs; Mute, Archive, and Block are provided through one
  overflow action menu.
- Chat uses the shared multiline composer with the post-media image preparation
  preset, an eight-image attachment limit, and inline image rendering in
  message bubbles.
- Shared profile-picture avatars use the current accent color for their border
  in both light and dark themes.
- Profile moderation actions use the shell-owned contextual NavigationBar
  overflow menu rather than a detached menu in the profile action row.
- Ink and muted gray establish the text hierarchy.
- Paper and background colors distinguish surfaces from the application
  canvas.
- Danger colors are reserved for errors, destructive actions, and warnings.
- The in-app accent may be device-local, but public marketing surfaces retain
  the fixed Friink brand color. The implemented Accent color setting is
  currently hidden from the General settings UI until it is intentionally
  re-exposed.
- Every light-theme surface and foreground must have an intentional dark-theme
  equivalent with sufficient contrast.
- Profile-picture borders use white in the light theme and `#111111` in the
  dark theme so the border blends with the surrounding dark background.
- Notification dropdown rows use a muted neutral unread surface rather than
  the brand accent, with a small consistent gap between rows.

### Typography

- Use a friendly display face for headings, navigation labels, tabs, and
  action-driven text.
- Use a highly readable body face for posts, messages, About text, and input
  content.
- Typography should establish hierarchy through size, weight, and spacing
  before relying on color.
- The signed-in web app uses a slightly more generous shared scale (`12px`
  small, `14px` supporting, `16px` body) and readable `1.5` body line-height.

### Shape

- Standard controls, inputs, cards, menus, and floating surfaces use a modest
  rounded corner rather than a pill shape.
- Avatars are circular.
- Pills are reserved for compact status or count indicators where the shape
  communicates the meaning.
- Destructive or high-consequence actions should not be made visually casual.

### Separation and elevation

- Prefer thin dividers and spacing to separate related content.
- Use bordered surfaces and restrained shadows for floating or layered
  content, not for every individual list item.
- Feed posts remain flat list items, with a subtle surface shift on hover;
  shared content panels should not add visible side lines or outlines solely
  to establish depth.
- Post media uses predictable layouts: one natural-ratio image, balanced
  two-item grids, a larger lead image for three items, and a four-item grid
  with a `+N` overflow indicator. Selecting media opens a dedicated full-screen
  lightbox with contained sizing, accessible previous, next, close, counter,
  and keyboard controls; tall images must not be cropped, and media never
  autoplays audio.
- Settings, chat, notifications, and directory rows should share a calm
  divider-based rhythm.

## Layout principles

- The authenticated application uses a persistent or overlay navigation shell,
  a main content panel, and a shared content surface.
- Primary content remains readable on wide screens through a centered shared
  column rather than stretching indefinitely.
- Shared containers own outer gutters and width constraints. Child screens
  must not introduce competing page-level padding or max-widths.
- Persistent bottom surfaces must not cover page content; pages reserve space
  for them.
- On narrow screens, content remains fluid within a modest gutter and controls
  remain usable without horizontal scrolling.
- Profiles remain focused on identity and profile content; global post
  composition is not shown there unless a future contract explicitly changes
  that decision.

The exact widths, heights, breakpoints, and token names are defined in
[`packages/design/design.md`](../packages/design/design.md).

## Surface and navigation patterns

- Use the shared application shell for signed-in surfaces.
- Use the global header for utilities such as Search, Chat, and Notifications.
- Use the drawer for personal identity, network navigation, Saved, Directory,
  Settings, and staff discoverability.
- Use addressable links for stable destinations so browser history, status
  previews, middle-click, and open-in-new-tab behavior remain available.
- Use the shared navigation bar and tabs for subpages and addressable sections.
- Drawer active state follows the destination being represented: Profile is
  active only for the signed-in user's own profile. When browsing another
  user's profile, neither Home nor Profile is highlighted.
- The unified `TopBar` preview uses one consistent leading/context/actions
  structure across signed-in surfaces, uses the same surface as the side
  drawer, and keeps the compact Friink mark visible in every mode. The mark
  always links Home except on the search route, where the search field occupies
  the middle slot between Back and Actions. The page title stays centered on
  other routes. The existing Header and
  NavigationBar remain mounted but are hidden during preview evaluation. Home exposes the sidebar toggle, compact
  theme-aware mark, Search, Chat, and Notifications. Contextual screens add a
  history-aware Back control and the existing ActionMenu. Its
  preview controls must preserve existing route destinations and action
  semantics until the replacement is accepted. The top-bar inner rail is
  full-viewport width with only the shared edge padding; it must not use a
  centered max-width cap that creates empty horizontal rails on wide screens.
- The persistent Search field on `/search/{query}` does not force the optional
  suggestions dropdown open; dropdown visibility is controlled separately from
  the field's route visibility.
- Use the shared floating bar for persistent contextual actions such as post
  composition.

## Interaction patterns

### Scrollbar treatment

The web platform uses native scrolling with a shared CSS scrollbar treatment.
Scrollable surfaces use a thin rounded muted-neutral thumb blended from the
theme's muted and line colors, with a slightly stronger neutral hover state and
transparent tracks. The scrollbar must not use the brand/accent color. The
styling must preserve native wheel, keyboard, touch, accessibility, and
reduced-motion behavior; JavaScript scrollbar replacements are not part of the
platform design system. In dark theme, the thumb uses a darker neutral (`#666666`)
with `#7a7a7a` on hover so it remains visible without appearing washed out.
Direct conversation pages use the document viewport as the only native scroll
surface for the message history; they must not introduce a nested message-only
scrollbar. The participant header remains fixed below the global top bar and
aligned to the centered chat content column. On desktop, its opaque background
spans the full main panel so messages cannot show through beside the capped
column. The shared content width cap remains intact. Shared shell bottom
padding must not compound the chat message-list reservation; the fixed
contextual composer remains 1rem from the last message on every viewport.

### Actions

- Each surface should have one visually clear primary action.
- Secondary actions should remain available without competing with completion.
- Shared primary buttons use a solid accent surface with contrasting text;
  shared secondary buttons use a translucent accent surface with accent text.
  This semantic treatment is independent of whether the button contains text,
  text and an icon, or only an icon.
- Icon-only controls require accessible labels and tooltips where appropriate.
- Destructive actions require explicit confirmation and explain consequences.

### Forms

- Labels, helper text, validation, and error messages should be clear and
  located near the relevant control.
- Preserve user-entered values when a submission fails whenever safe.
- The signed-in user's own profile shows the standalone new-post composer;
  other profiles keep it hidden but show the shared contextual composer after a
  visitor selects Reply or Quote on a profile post.
- Composer text is screen-local and in-memory only; leaving a composer does
  not restore its previous text from browser storage.
- Do not replace a loading state with a generic disabled state that hides why
  the user cannot continue.

### Loading and asynchronous work

- Every action that starts asynchronous work communicates that work visibly.
- Loading prevents duplicate activation until the operation settles.
- Loading, transport failure, and policy-based disabled states are distinct.

### Empty states

Empty states should be calm and explanatory. They should tell the user whether
there is simply nothing to show, whether content is private or unavailable, or
what action can populate the surface.

### Error and recovery states

- Explain what happened in plain language.
- Explain what the user can do next.
- Preserve usable current state during recoverable failures.
- Do not expose tokens, hashes, internal identifiers, IP addresses, or account
  existence through copy or visual details.
- Retry should be explicit when retrying is useful.

Direct post URLs that resolve to a missing, deleted, private, or otherwise
inaccessible post use a post-like unavailable state rather than the generic
404-styled error surface. The state uses calm explanatory copy and a `Go home`
action; it must not expose technical error codes or reveal whether a protected
post exists.

### Beta disclosure

Use a small visible `Beta` badge when an otherwise available feature is still
being stabilized. The badge is informational only and must not change feature
permissions or behavior. Features not yet available use the existing
`Coming soon` or planned treatment.

### Subscription status and entitlement disclosure

Subscription surfaces use explicit plan and lifecycle labels: `Free`, `Pro`, or
`Pro+` for the effective plan, and `Active`, `Expired`, or `Revoked` for the
assignment state. Indefinite access is labeled `No expiration`. Manual admin
access is described as granted or activated access, never as a purchase.
The self-declared `Professional` badge is opt-in and hidden by default. The
staff-controlled `Friink Registered` badge is shown while registration is
active and cannot be hidden. The
professional-badge preference is conditionally revealed under the General
`How I use Friink` setting only for `For professional networking`; it is not
shown for `For personal connection`. When enabled, the badge sits immediately
next to the user's displayed name on the public profile. The preference
changes profile display only and must not imply Friink registration,
directory eligibility, or paid access. Expiry and revocation messaging must
explain the resulting
return to Free without implying a payment event when billing is unavailable.
Both profile badges use the shared accent-colored compact pill treatment,
including inside the side drawer, and remain icon-only with accessible labels.

The planned manual-access flow uses calm confirmation summaries, `Grant
access`, `Change access`, and `Return to Free` language, in-app status
feedback, and optional email mirrors. Staff see assignment history and audit
reasons; users see their effective plan, status, expiry, and concise
change feedback. Paid-only states remain contextual and
server-entitlement-driven; while billing is unavailable, the plan comparison
is the only surface that uses `Coming soon` for unimplemented paid actions.

### Feedback

Use inline feedback when it belongs to a specific control or flow. Use shared
toasts for app-level results that should not disrupt page content. Success,
failure, and security feedback should be distinguishable without relying on
color alone.

## Component usage

The product uses shared patterns for identity blocks, rows, buttons, inputs,
tabs, menus, modals, toasts, content surfaces, composers, and media galleries.

Before creating a new pattern:

1. Check whether an existing shared component already expresses the behavior.
2. Check whether the component can be extended without breaking its contract.
3. Document a new reusable pattern before introducing it in multiple places.

Feature units own what a component means in context. This document owns the
shared design language. The implementation details and component contracts are
in [`packages/design/design.md`](../packages/design/design.md).

Icon-and-text primary and secondary buttons use a consistent 8px inline gap;
icon-only `.icon-button` controls remain compact and are excluded. Button-like
links use the same shared primitives and never display browser-default
underlines.

## Accessibility

- Every interactive control must have an accessible name and a visible or
  programmatic state.
- Keyboard users must be able to reach, operate, and dismiss controls.
- Focus must remain visible and must not be clipped by overlays.
- Dialogs must manage focus, expose a title, support Escape where appropriate,
  and keep their actions reachable.
- Do not rely on color alone to communicate status, selection, or errors.
- Text, controls, and focus indicators must remain readable in light and dark
  themes.
- Responsive behavior must not introduce horizontal overflow or hide required
  actions.

## Content and language

- Use plain, calm, direct language.
- Tell users what happened and what they can do next.
- Avoid internal implementation terminology in user-facing copy.
- Do not reveal account existence, secrets, raw identifiers, or security
  metadata through messages.
- Keep labels consistent across related flows and units.

## Boundaries and authority

- Product and business behavior belongs in the relevant unit document and
  cross-unit rules belong in [`rules.md`](./rules.md).
- Shared design intent belongs here.
- Exact code-level token values, CSS ownership, component props, and source
  files belong in [`packages/design/design.md`](../packages/design/design.md).
- Feature-specific visual behavior belongs in the feature unit, which should
  link back here when it uses a shared pattern.

## Known gaps

- Native mobile design and interaction requirements remain deferred until a
  mobile client exists.
- Some public and staff surfaces remain placeholders and need their own
  product contracts before they become fully designed.
- Exact implementation gaps and release verification status are maintained in
  the implementation contract.

## Change checklist

- [ ] The change is a shared design decision rather than a feature-only rule.
- [ ] The product intent is documented here.
- [ ] The implementation contract is updated if tokens or components change.
- [ ] Affected unit documents link to this document where relevant.
- [ ] Accessibility and light/dark behavior were considered.
