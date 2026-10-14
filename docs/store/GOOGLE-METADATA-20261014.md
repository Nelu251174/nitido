# Google Play metadata correction — 14 October 2026

Owner screenshots identify a Metadata policy rejection in the Romanian full
description. They do not show the rejected description text or require a binary
change. The installed store field still needs to be read before claiming the
precise offending sentence. The account's rejection is not a suspension notice.

The replacement in `METADATA-RO.json` → `google.fullDescription` explains physical
cleaning services in Romania, the customer booking flow and the provider workflow.
It uses existing source-backed features and conditional coverage. It makes no
instant-provider, GPS-tracking, bank-payment timing or European service-coverage
promise, and contains no unrelated third-party brand promotion.

The older copy in `../publicare-aplicatie-mobila.md` contained guaranteed Express
60, ambiguous live-tracking and payout claims. That copy is withdrawn in favor
of the canonical package. It is not asserted to be the rejected console text.
The existing Apple description is preserved separately.

## Console correction

1. Open the existing NITIDO app (`ro.nitido.app`).
2. Open the default store listing under Grow users → Store presence → Main store
   listing (Romanian UI labels may differ); select the Romanian listing.
3. Read/copy the rejected full description, then replace it with
   `google.fullDescription`. The corrected short description is also prepared.
4. Save the listing and verify its preview. Changes to these metadata fields do
   not by themselves demonstrate a new Android bundle requirement.
5. Open Publishing overview and send the corrected listing changes for review
   using the available console action. Confirm the actual in-review status.

The current screenshots show rejection; this repository change is preparation,
not evidence of a console update, resubmission or Google approval. No browser
control or authenticated Google Play metadata API is available in this session.
No customer data, test credentials, payment settings or native binaries changed.
