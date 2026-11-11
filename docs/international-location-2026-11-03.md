# European booking location — 3 November 2026

The shared website/Capacitor booking interface now supports the same optional device-location mechanisms used by the existing Romanian booking flow, with separate European market validation. No Romanian geolocation component, parser, endpoint, pricing or scheduling module was changed.

## Behavior

- The user presses the GPS action and the browser/native Geolocation plugin requests permission. There is no automatic GPS prompt on entry and no background tracking.
- When the existing server Google geocoding configuration is available, precise device coordinates are sent to a new authenticated, rollout-gated, rate-limited `/api/international/location` endpoint. It returns a candidate country, configured city, street and optional postal code. Only rooftop results may supply a house number; an approximate/interpolated result never invents one. Credentials stay on the server and coordinates are not persisted or included in the response.
- Without address-service configuration, the existing BigDataCloud device-coordinate mechanism proposes the locality only. The disclosure identifies this provider. Street, house number and postal code are not invented; manual entry remains available in the booking flow.
- All 78 configured cities in the 26 foreign markets are recognized, with explicit country-scoped exonyms. Suburbs, districts, unsupported cities and countries are refused rather than replaced by a capital or nearby covered city. Detection does not expand commercial coverage or approve a tariff.
- A proposal is applied only after explicit confirmation. GPS starting stops a late connection-country suggestion from overriding that action. A manual address edit while detection is pending prevents stale data from being applied. Changing country/city cancels the previous location component; leaving/disabling the component aborts its request.
- Confirmation selects the exact work country/city, transfers street/postal code, and invalidates the previous quote. A change of work place or street/postal address also clears floor and local schedule. Floor/schedule edits made during GPS detection invalidate the pending candidate. Coordinates are not saved in the booking. Language and connection IP do not override the confirmed work address.
- The confirmation label was added to all nine released catalogs; every pre-existing translation is byte-for-byte unchanged as a value. Native manifests, plugin configuration and dependencies were retained.

## Verification

- Consolidated tests: **3,282 passed, zero failed, one pre-existing omission**.
- Focused location plus Romanian regressions: **71 passed**.
- Production build using the repository's default Next.js 16.4.3 Turbopack command and TypeScript passed in the complete isolated application with local dependencies. Changed-source ESLint and i18n prebuild passed; nine catalogs contain 5,766 messages each.
- Real isolated production browser: **22 controls passed**, no uncaught JavaScript errors, no horizontal overflow at 390/1440 px. Includes actual authenticated API configuration, anonymous/client restrictions and origin refusal; device permission denial; explicit candidate confirmation; street/postcode handoff; stale edit protection; quote invalidation; locality-only fallback; unchanged Romanian entry; and refusal of an actual isolated quote without a commercially approved tariff.
- Sixteen Romanian core/native/dependency files were compared with the starting commit and are identical. All existing values in the nine catalogs are preserved, with one added confirmation label each.

Browser GPS coordinates and Google/BigDataCloud replies were synthetic fixtures. One browser-only quote fixture verifies UI handoff/invalidation; it is not a real commercial price, a successful server quote, or a processor test. The screenshots show the synthetic location proposal before confirmation and no invented purchasable price. The app container had no external network. No real geocoder invocation, installed iPhone/Android package, physical-device GPS permission, store publication or LIVE provider configuration is claimed verified.

## Release state

Prepared in draft PR182; **not deployed or activated on LIVE**. Existing commercial/provider approval, actual processor lifecycle/settlement and email-delivery release gates remain open. This location change neither bypasses them nor changes LIVE data, flags, roles, Marketing, notifications or financial settings.
