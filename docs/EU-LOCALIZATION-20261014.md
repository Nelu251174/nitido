# NITIDO interface in the 24 official EU languages

Scope: public pages, customer and cleaning-company screens, and the remotely
loaded Capacitor interface. Catalog generation is in progress. Non-Romanian
rendering remains disabled until every catalog passes validation.

Current blocker: the existing OpenAI API account returns HTTP 429 with error
type `insufficient_quota`. A single-request diagnostic confirmed this; generation
is paused until the account's available credit/project limit is resolved. The
owner-approved USD 20 cap is unchanged. No deployment has been performed.

Eight new catalogs are complete and saved for review: bg, hr, cs, da, nl, en,
fr and de, each with 4,540 source messages. Romanian is the source language.
Private resumable checkpoints retain 62,244 translations, including unfinished
catalogs; unfinished files are not included in the release. The global activation
gate deliberately remains closed.

Languages: bg, hr, cs, da, nl, en, et, fi, fr, de, el, hu, ga, it, lv, lt,
mt, pl, pt, ro, sk, sl, es, sv.

## Language selection and data

The saved `nitido-language` cookie has priority and lasts one year. Otherwise,
weighted browser/device language preferences are used. A local IP-country
lookup is a fallback when no supported language matches; multilingual countries
such as Belgium have no guessed language. Romanian is the default. Pages use
private/no-store caching, and only the selected language catalog is delivered.

Source-owned labels, public/legal copy, form guidance, accessibility text,
service/status labels, help topics and date displays use the selected language.
Display dates retain their existing operational time zones. Help search accepts
both the original and translated topic titles. Browser alert copy is localized.

Names, property addresses, customer messages, free text, form values, URLs,
service/role/status identifiers and payment parameters retain their original
values. Operator/admin screens are outside this release. Background SMS, email
and native push still use the existing recipient-language behavior; no account
language column or database migration is introduced.

## Generation and validation

The owner authorized OpenAI translation of repository-owned UI copy only, with
a total cap of USD 20 before tax. Private resumable checkpoints preserve request,
token and cost accounting across attempts. Each API request reserves its upper
cost before dispatch. Valid strings are saved and only rejected strings are
retried. Brands, contacts, numbers, currency words and interpolation values are
protected; incomplete catalogs cannot activate the feature.

Currency codes are matched as whole words, so French `VALEURS`/`SECTEUR` and
Estonian `BRONEERING` are not mistaken for EUR/RON. Romanian `lei`/`leu` units
remain protected when present in the source; the Portuguese legal word `lei`
does not introduce a false currency mismatch. Seven regression checks retain
rejection of modified amounts, currencies, contacts, slots and missing keys.

The latest confirmed processed-token cost estimate is USD 10.96190925 before
tax. Conservative retained accounting is USD 11.88488925; the remaining approved
allowance is USD 8.11511075. These are generation accounting estimates, not a
claim about the provider account balance or final invoice. All 207 requests
declined during the latest two runs added no processed tokens. Only safe error
categories are retained; provider messages and credentials are not exported.

Intermediate catalogs and the temporary upload link are encrypted with the
operator-owned public key. The private decryption key remains in the workspace.
The owner explicitly approved recovering ciphertext through public GitHub
Actions logs. The OpenAI credential stays on its existing host and is never
exported. No customer records are sent through this translation workflow.

`node scripts/i18n-validate.mjs` checks all 24 catalogs against the source hash,
exact keys, protected values and unexpected markup. Catalogs are machine
translations; specialist legal review remains pending. `messages/extra-source.json`
keeps short mapped labels in the reproducible extraction source.

The npm build preflight and language CI require complete valid catalogs and
matching generated offline copy. The offline generator uses the same 24
catalogs, the manual cookie, device preferences and cached last language.
Generation of the final offline HTML remains pending complete catalogs.
`node scripts/i18n-validate.mjs --available` validates the complete catalogs
already saved for review. It reports `publicationAllowed: false`; the build
uses the strict validation command without this diagnostic option.

## Currency and service coverage

The country of the work determines currency: Romania uses RON; all other 26 EU
countries use EUR, including EU countries outside the eurozone. Language, cookies
and visitor IP cannot change that currency. Romanian quote snapshots explicitly
record RO/RON. Quote and job creation reject a mismatched currency.

Only Romanian tariffs and coverage are configured. Foreign bookings stop before
pricing or payment; a Romanian amount is never relabeled as EUR. Activating a
foreign service market requires its tariffs, local coverage and provider setup.
Historical prices and existing Stripe authorization, capture, transfer and
refund behavior are preserved.

## Verification

The expanded suite passed 119 checks for language negotiation, translation/data
isolation, dates, navigation, store promotion guards, quotes and country/currency
rules. TypeScript and targeted lint passed for the later implementation changes;
the seven currency/data catalog regression checks also passed. Candidate 2811dbf
passed a hosted full build and an unsigned iOS compile. The later publication
guards deliberately fail the full-catalog preflight until the remaining 15
languages are complete. Complete-catalog validation, hosted mobile rendering in
all 24 languages and deployment health remain required before activation.

The approved iOS 1.0 (17) continues to load the shared remote interface; this
change does not upload a new store binary or withdraw the approved version.

Country lookup uses `geoip-country` and its bundled GeoLite2 data. This product
includes GeoLite2 data created by MaxMind, available from https://www.maxmind.com.
Retain the package license/EULA with any distribution.
