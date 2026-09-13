# Updated Account Information

## Account settings

Settings > Account shows two read-only account-history fields:

- **Joined**: the account’s server-authoritative creation date and time from
  `users.created_at`, formatted for the user’s locale and time zone. It is not
  derived from the browser clock and cannot be edited.
- **Region**: the province/state-level region associated with the request at
  account creation. The value is derived from the deployment’s trusted
  country-region geolocation signal and stored as an ISO 3166-2-style code
  such as `PK-PB` or `US-CA`. It is not a precise location, city, address, or
  GPS value, and it cannot be edited.

The application does not store the raw IP for this feature. If the trusted
region signal is unavailable, the Region field displays `Unavailable`. Existing
accounts created before this field was introduced may also display
`Unavailable`; no inferred backfill is performed.

The existing user-entered profile `location` field remains separate from this
account-creation region value and is not used to populate it.

## Onboarding profile information

The post-account-creation wizard also collects two optional profile values:

- **Location**: a user-entered profile value, such as a city, region, or place.
- **How I use Friink**: a private preference with one of two values: `For
  professional networking` or `For personal connection`.

Both values are saved through the normal authenticated profile-update path and
can be edited later. They currently have no effect on access, billing,
recommendations, ranking, or other business rules.
