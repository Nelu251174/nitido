# ADMIN notifications and registration layout

The owner requested one compact row per registration and a notification bell in the top navigation. The bell is present in the main ADMIN toolbar, Marketing and the daily attention page. It opens a category-filtered list with an unread badge and links to the relevant destination; `/admin/notificari` provides pagination. Opening the bell alone does not mark anything read. Reading a registration through either interface is reflected in the other.

The feed combines stored registrations/reports with jobs, current attention signals, assessments/client messages, payment/authorization/cancellation/webhook/payout updates, reviews/reports/proofs, pending firms, account-deletion intake, Marketing collection results and failed delivery signals. It never initiates delivery, payments or operational changes. It reads recent stored source records (up to 1,000 owner events and 300 per general source; existing attention-source bounds remain). It displays each source's current state, rather than inventing a historical event stream for state transitions not recorded by that source.

The API requires the existing super-admin permission. Responses are private/no-store, POST is same-origin, read state is bound to the authenticated actor and the exact item revision, and stale/forged selections roll back atomically. Only an additive `admin_notification_reads` table is introduced. Names and emails are escaped by React; destinations are internal paths. A source status update makes a previously read operational item unread again. Automatic reads never send email or messages.

Registration data is split into separate columns with no wrapping; on narrow screens the table scrolls inside its panel. Provider acceptance is labeled `Acceptat` with its delivery limitation available in the tooltip. Store-report explanations are collapsed by default.

## Corrected city instruction

The owner clarified that Constanța must be added alongside Iași, Cluj and București. The previous interpretation that paused Cluj/Iași was incorrect. The tested manual `mca.cjs` helper restored only ready campaign states paused by that operation, enabled independent collection for CT/CJ/IS/B, preserved source deadlines and progress, and did not create new mail runs. Execution completed successfully; its temporary scheduled task was removed. The old `mct.cjs` helper now refuses execution. The corrected instruction supersedes the earlier pause.
