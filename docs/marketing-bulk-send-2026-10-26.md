# Manual bulk campaign workflow

Each campaign card exposes its own bulk-send entry point, including drafts. Preparation shows the selected region, locality, category, eligibility counts, exclusions, sender blockers and delivery configuration beside the action. The bulk-send entry point only checks readiness; a separate unchecked confirmation and explicit final action are required to create a live delivery run. Archived campaigns remain archived.

The optional complete-audience checkbox, applied with Prepare, saves the current text without A/B partitioning or a recipient cap, while retaining its region/locality/category. Existing drafts are not migrated automatically. New blank campaigns default to no recipient cap. Existing A/B and pilot caps remain visible until explicitly changed. București remains separate from Ilfov.

The daily limit controls processing, not the total queued audience. Sender, consent evidence, contact review, technical email verification, suppression, deduplication, campaign budgets, monthly budgets, provider configuration, webhook configuration and explicit delivery enablement remain enforced. Queue creation remains idempotent; repeated queueing for recipients already in that campaign is rejected. Preparation never grants consent, changes contacts, enables delivery, or sends mail. Tests use synthetic recipients and mocked transport only.

Sender errors now name only missing fields. Settings offers an explicit form-only shortcut to use the sender's address as Reply-To; saving remains manual. Campaign links to contacts retain the region, locality and category.

Validation: 50 focused tests cover blocked drafts, an archived campaign, complete-audience selection, explicit test versus live confirmation, concurrent edits, sender diagnostics, and a 5,003-recipient București queue that processes only one message under a daily limit of one without dropping the remaining 5,002. TypeScript, scoped lint and the prebuild checks also pass. No actual delivery flags, sender data, contacts or campaigns are changed by deployment.
