# NITIDO EU language preparation

Requested scope: the 24 official EU languages, on the website and the remotely
loaded Capacitor interface. This change prepares that interface; **the full
translated catalogs are not generated and the feature remains disabled**.

Languages: bg, hr, cs, da, nl, en, et, fi, fr, de, el, hu, ga, it, lv, lt,
mt, pl, pt, ro, sk, sl, es, sv. All use left-to-right layouts.

## Behavior prepared

1. An explicit `nitido-language` cookie wins and persists for one year.
2. Otherwise, the browser/device `Accept-Language` preferences are weighted.
3. If none match, a local country database can provide a fallback. The IP is
   never sent to a geolocation or translation service. Multilingual countries
   such as Belgium deliberately have no country-to-language guess.
4. Romanian remains the default. Only the selected language's catalog is loaded.
5. Pages are private/no-store to prevent a shared cache from serving another
   visitor's language. Existing private-route noindex rules remain in place.

The language selector and non-Romanian rendering are gated by a complete
manifest. Choosing a language with Romanian placeholder catalogs is prohibited.

Static JSX, display attributes and proven static label collections have been
adapted across public/client/firm/Pro screens. Interpolated UI templates have
named slots so translators can reorder values. User names, addresses, free
text, message content, input values, URLs, form names, role/status keys and
payment parameters remain unmodified. Operator/admin UI is outside this release.

Metadata display fields have request-scoped translation helpers; canonical URLs,
robots, verification settings and route paths stay intact. Dynamic city copy,
remaining mapped field labels, notification text, date/number formats and
localized help search still require a coverage pass before activation. SMS,
email and background push do not yet persist a recipient-language preference.

## Offline generation and release gate

`node scripts/i18n-extract.mjs` creates the source-only inventory, including
literal placeholder templates. The extract excludes admin, security, DB and
support-AI internal files. `.translation-work/sources.json` records ownership locations;
it is not sent to the translation provider. Runtime/user records are never read.

`scripts/i18n-translate.mjs` is a resumable operator-run generator using the
existing OpenAI provider credential and Responses API (`gpt-5.4-mini`). It sends
only source UI strings, uses `store:false`, processes at most three batches at
once, and caps attempts/tokens and API usage at 20 USD (before tax), including conservative reservations for requests with unknown billing outcomes. It does not print, copy or export the credential.
Default output `.translation-work` is private and gitignored; output paths
under `public` or `uploads` are rejected. Every response must preserve counts,
numeric tokens, currencies, contacts, brands and placeholder slots. Partial
catalogs are checkpoints, never supported languages.

Before activation:

```sh
node scripts/i18n-extract.mjs
NITIDO_TRANSLATION_MAX_REQUESTS=1800 NITIDO_TRANSLATION_MAX_TOKENS=6000000 node scripts/i18n-translate.mjs
node scripts/i18n-validate.mjs .translation-work
```

Run generation only after the owner approves the external-provider operation.
Then copy the validated locale JSON/manifest into `messages`, complete the
remaining coverage pass, run the build and hosted browser checks for all 24
locales, and deploy to sandbox before production. Review machine translations
of legal/business copy before representing them as final legal texts.

Automatic approval review rejected the earlier proposal to execute generation
on production and write results into public uploads. That action did **not**
execute. The revised generator keeps checkpoints private and excludes internal
operator/security source. External generation is still pending owner approval;
no attempt has been made to bypass the rejection.

No service-country expansion, Euro conversion, processor settings, capture/
transfer/payout changes, schema migration, public deployment or new native
store build accompanies this preparation. The approved iOS 1.0 (17) stays intact.

Country lookup uses `geoip-country` and its bundled GeoLite2 data. This product
includes GeoLite2 data created by MaxMind, available from https://www.maxmind.com.
Retain the package license/EULA with any distribution.

## Verification evidence

The targeted suite passed 56 tests and TypeScript passed. The behavior audit
compares existing external calls and interaction/access attributes against
7480c0462e75a85fd7819ed5be86963071eb388f; they remain unchanged across the
modified existing TSX files. Earlier blob publication rejections referred to
existing GPS/payment flows; baseline diffs and behavioral fingerprints showed
that this work only adds localization rendering, not new disclosures or charges.
Full build and all-language hosted checks remain release requirements.
