# Visible bulk-send workflow and archived campaigns

The archived card previously displayed a disabled bulk-send button styled like an available action. Replace it with an explicit Create draft from this campaign action. This saves a new draft with the same subject, text and audience settings; it keeps the original archived campaign and its history. The new draft is loaded and previewed immediately. Deployment itself does not create any copies or change campaign records.

For active drafts and ready campaigns, Prepare and Bulk send open a native modal immediately. Its loading status, readiness results and network errors stay visible regardless of the page's scroll position. The modal identifies the campaign and recipient scope, supports Escape and Close, and retains the separate manual confirmation and existing server gates for actual delivery. A late response does not reopen a closed modal.

Validation: 52 focused tests; TypeScript, scoped ESLint and prebuild checks; desktop and mobile browser fixtures verify the actual native modal, Escape, network-error visibility, archived-to-draft copying, and no queue/send requests. All fixture data and transport are synthetic. No delivery flags, contact eligibility or sender settings are changed.
