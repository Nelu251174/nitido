# Pro report completeness

Cost reports previously limited SQL results before permission filtering. This could hide permitted costs behind newer inaccessible records and silently truncate exports.

The cost collection now iterates in deterministic date/ID order and applies financial property permissions before counting results. Up to 1,000 permitted records are returned completely. Above that threshold the request fails with HTTP 422 and asks the user to narrow the period, property, or category. Failed exports do not create a successful export audit entry. Existing private/no-store response headers remain enforced.

Validation: 44 tests passed across Pro core and route suites; TypeScript noEmit passed. Regression coverage includes 1,000-row export, explicit overflow failure, audit behavior, and permitted rows following more than 1,000 inaccessible rows.

This is a code validation package. Sandbox visual validation and the real Pro pilot remain open. No LIVE or mobile-store release was performed.
