# NITIDO interface in the 24 official EU languages

Scope: public pages, customer and cleaning-company screens, and the remotely
loaded Capacitor interface. Catalog generation is in progress. Non-Romanian
rendering remains disabled until every catalog passes validation.

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

Intermediate catalogs and the temporary upload link are encrypted with the
operator-owned public key. The private decryption key remains in the workspace.
The owner explicitly approved recovering ciphertext through public GitHub
Actions logs. The OpenAI credential stays on its existing host and is never
exported. No customer records are sent through this translation workflow.

`node scripts/i18n-validate.mjs` checks all 24 catalogs against the source hash,
exact keys, protected values and unexpected markup. Catalogs are machine
translations; specialist legal review remains pending. `messages/extra-source.json`
keeps short mapped labels in the reproducible extraction source.

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
rules. TypeScript passed. Candidate 1875846 passed a hosted full build and an
unsigned iOS compile. Complete-catalog validation, hosted mobile rendering in
all 24 languages and deployment health remain required before activation.

The approved iOS 1.0 (17) continues to load the shared remote interface; this
change does not upload a new store binary or withdraw the approved version.

Country lookup uses `geoip-country` and its bundled GeoLite2 data. This product
includes GeoLite2 data created by MaxMind, available from https://www.maxmind.com.
Retain the package license/EULA with any distribution.
