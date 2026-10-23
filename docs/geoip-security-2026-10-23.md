# GeoIP dependency remediation — 23 October 2026

**Completed and published:** source `d25796c` is healthy on sandbox and LIVE. LIVE publication finished at 23:25 on 23 October 2026 (Europe/Bucharest). The installed containers passed local IPv4/IPv6 lookup checks. Post-release probes passed 66 page/API checks, 48 assets and four manual-language priority checks. The website dependency audit reports zero vulnerabilities.

`geoip-country@5.0.202610140208` declares `ip-address@^6.4.0` for its database conversion utility. That dependency causes the high `ip-address` and moderate parent `geoip-country` audit findings. The production country lookup does not import that converter; both locale selection and optional signup-country recording use the same existing local database.

The scoped npm override pins only GeoIP's `ip-address` dependency to **10.7.4**, which addresses the reported advisories. Its native BigInt API replaces the old JSBN `bigInteger()` API. The install bridge changes the four calls in the upstream converter to `bigInt()` and verifies both the dependency versions and the complete converter's before/after SHA-256. Unknown versions or contents fail installation. The patch is idempotent; it neither downloads country data nor runs a database conversion during installation.

The existing decimal conversion remains exact because IPv4 values are bounded by `2^32-1`. The real upstream converter is tested offline with country and city CSV fixtures, including IPv4 zero/maximum boundaries and IPv6 ranges. Simply overriding the dependency without this bridge would break IPv4 country/city conversion.

Docker copies the bridge into the dependency stage before `npm ci`. No additional patching package or external geolocation service is introduced. The GeoIP dataset and its license files stay unchanged; country lookup remains local. Existing manual-language priority, forged-country-header removal and browser-language fallback are covered by the application tests. No customer account, booking, price, payment or notification setting changes.

Validation commands:

```sh
npm ci
npm audit --audit-level=low
node --test scripts/geoip-compatibility.test.mjs
npx eslint
npx vitest run src/i18n/ipLanguage.test.ts src/i18n/localization.test.ts src/lib/siteIndexing.test.ts src/lib/signupPersistence.test.ts src/lib/adminOwnerEvents.test.ts
npm run build -- --webpack
```

The compatibility tests are also run in an isolated container with networking disabled. All three compatibility tests, 42 application tests, ESLint, the production build and `npm audit` also passed in [GitHub CI](https://github.com/Nelu251174/nitido/actions/runs/40018142275). Android and iOS native compilation passed with the same dependency installation. No new mobile binary is published by this change.

Exact source/deployment receipts are recorded in [geoip-security-20261023.json](evidence/geoip-security-20261023.json). The general audit report preserves the original finding with a remediation note; translations and the physical Android startup issue are separate work.

For a future `geoip-country` release, review its converter, remove this bridge if the maintained API is supported upstream, update the scoped override as appropriate, and rerun the offline fixture and locale/signup tests. Do not update the pinned version or expected hashes without reviewing the converter.
