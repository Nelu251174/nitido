# Google Ads company signup measurement

Account tag supplied by the owner: `AW-18344130112`.

Basic Consent Mode: no Google library or measurement before explicit advertising-cookie acceptance. Both choices have equal prominence. The local preference expires after 180 days. The public footer reopens settings. Withdrawal clears only `_gcl_` first-party cookies, sends denied consent and reloads to unload the third-party library. Analytics storage, ad personalization and enhanced conversions remain disabled. Consent UI and disclosures are translated in all nine released languages.

The tag is restricted to nitido.ro/www.nitido.ro web browsers; sandbox and Capacitor native apps never load it. Account/admin/API routes emit no page views. URL parameters are removed except syntactically validated Google click IDs. No signup fields, email, phone, CUI or user ID are sent. A random transaction ID belongs to the single successful signup response.

## Remaining Google Ads configuration

The base tag is not a signup conversion. Obtain the event snippet for the company signup conversion in Google Ads. Set its label (the suffix after `AW-18344130112/`) as runtime variable `GOOGLE_ADS_COMPANY_SIGNUP_LABEL`. It is public configuration, not an API credential. Never invent a label or use a page visit as the conversion. Without this label the conversion call remains disabled.

The signup page invokes conversion tracking only for HTTP 201, `ok: true`, `role: firma` from `/api/auth/signup`. Failed or client signup and ordinary page views cannot emit this conversion. Measurement exceptions do not affect signup confirmation. Email confirmation and ANAF validation are separate business events.

Before activating paid ads: test accepted/refused consent and a mocked successful signup in Tag Assistant, confirm the conversion action counts one signup, review Search network settings and the CPC warning, and confirm the EUR budget with the owner. Creating or deploying this change does not activate the Google Ads campaign.

Sources: https://developers.google.com/tag-platform/security/guides/consent?consentmode=basic and https://developers.google.com/tag-platform/security/concepts/consent-mode
