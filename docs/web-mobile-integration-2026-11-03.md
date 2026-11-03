# Shared web/mobile international booking integration — 3 November 2026

The European quote/booking flow is now connected to the ordinary website entry, which is also used by the Capacitor iPhone/Android shell. This change remains behind the existing international rollout gates; no LIVE deployment, flag change, commercial tariff approval or processor operation was performed.

## Resulting behavior

- With international pricing disabled, `/rezervare` retains the existing Romanian configurator and `/preturi` retains its existing Romanian price explanations and booking link.
- With rollout enabled, a fresh entry from a supported foreign IP suggests that market. Explicit work country wins over IP; Romanian query/draft context remains domestic. Existing same-tab public drafts and the presence of a private card-booking draft are checked after hydration before a form is mounted or navigation changes. Storage failures conservatively retain the domestic route. No private draft is decoded, removed or transmitted by this check.
- Invalid, duplicated or explicitly empty work country opens an unselected chooser. The `countryCode=` marker survives pricing CTA, login/signup and booking instead of being replaced by a later IP suggestion.
- Anonymous clients retain the selected market through login/signup. The new post-auth allowlist entry is exactly `/international/booking`, client-only, with existing origin and path normalization checks retained. The destination page checks the actual account role again.
- The opted-in foreign pricing page explains local verification and never labels the converted Romanian table as a foreign local tariff. Unknown/unapproved markets have no invented price or purchasable quote. Explicit Romanian price selection remains available abroad.
- The client respects manual country selection, including clearing it, when an asynchronous IP result arrives. EUR amounts use the selected display locale without a second FX conversion. Offer expiry is displayed in the work-market timezone.
- Native EUR booking/review routes suppress the legacy RON conversion disclosure. Existing disclosure behavior is retained on all other routes.

The booking/quote/pricing/payment implementations, activation flags, native package configuration, dependencies and all nine released locale catalogs are unchanged in this integration round. Romanian price explanations retain their original rendered-number regressions in Romanian and English. No new full-country language translation or physical-device certification is claimed.

## Validation

- Final consolidated suite at runtime commit `7db30c15e6961e57b138b05e7a74336df46b397d`: **3,242 passed, zero failed, one pre-existing omission**.
- Review-fix subset: **54 passed, zero failed**.
- Next.js 16.4.3 production build and TypeScript passed; changed-source ESLint and i18n prebuild passed. Nine catalogs retain 5,765 messages each.
- Actual isolated Next production browser: **25 passed**, no uncaught JavaScript errors, no horizontal overflow at 390/1440 px. Checks include rollout on/off, actual synthetic login preserving work country, unapproved quote refusal, client/admin separation, saved Romanian browser-draft recovery, explicit empty country, and domestic return without a redirect loop.
- Two independent source reviews passed after fixing the draft-storage and empty-country findings. Earlier pre-fix results are preserved separately and are not substituted for final verification.

The browser app container had no external network. All accounts, IP-header fixtures and booking inputs were synthetic and local. These country-header fixtures are not actual geographic connections. No real email, push, payment or customer booking was sent. Native source loads the approved web origin; installed packages, store releases and physical push reception were not tested.

## Release boundary

This is an implementation candidate, not a LIVE release. Existing commercial/real supplier, authorized processor lifecycle/settlement and LIVE email-delivery evidence gates remain open. The connector now exposes authorized TEST contexts, but its available PaymentIntent methods did not expose creation/capture; no provider lifecycle is marked passed on that basis. Zero foreign commercial tariffs are approved or activated. Owner authorization does not turn missing evidence into a green check.

No changes to Coolify, LIVE data, roles, Marketing or notification settings were made. Publish only after the remaining release conditions are satisfied; retain existing financial obligations and historical quotes during any future rollout/rollback.
