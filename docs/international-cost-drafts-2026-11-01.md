# International cost planning — draft registry

The public lists researched for foreign markets do not establish that an employee-based cleaning company can cover payroll, operating expenses and its margin. This change adds an authenticated planning registry at `/admin/costuri-internationale`, linked from **Financiar → Costuri efective**. It supports the existing 26 foreign EU markets.

## Commercial boundary

Every result and saved version is a **draft**, including when an administrator has checked all evidence fields. There is no publication/activation/payment action and the registry is not imported by booking, payment or native application services. Romania is rejected by the draft validator. `pricing.ts`, managed Romanian pricing, `configuredServiceMarket`, geolocation, display currency, commissions and mobile packages are unchanged.

Country and currency describe the work's market. IP and UI language are not accepted as pricing inputs. The planning currencies are EUR, CZK, DKK, HUF, PLN and SEK; this does not claim payment-provider settlement support. Changing country in the form clears costs, vendor information and evidence instead of relabelling amounts.

## Inputs and calculation

Use **annual total employer payroll per worker**, including contributions, contractual extras and paid time, divided by actual billed minutes. Do not enter an employee's net wage or apply another holiday/payroll multiplier to costs already included. Supplies, equipment and overhead are allocated per worker-hour. Travel and other visit costs are shared once per visit. The higher of three hours and the supplier's time minimum determines on-site duration. Worker-minutes equal duration times crew size.

Costs use integer minor units and BigInt intermediates. Cost components and the price floor round upwards. The price floor is total visit cost divided by `1 - platform/processing fraction - operating-margin fraction`. The margin is before corporate income tax. VAT is separate; an unknown VAT rate yields no gross total. A larger supplier visit minimum raises the visit amount without mislabelling it as an hourly tariff.

The built-in EUR example is **synthetic**: annual employer cost 28,500, annual billed hours 1,000, supplies 1.14/person-hour, equipment 0.43/person-hour, overhead 8.34/person-hour and shared visit travel 2.57. Combined commission/processing 10%, margin 15% and VAT 20% are assumptions, not the configured NÍTIDO fee or a universal tax policy. The suggested round-up is 53 EUR/person-hour net, or 159 EUR net for one worker for three hours. Its cent-level components are rounded adaptations of the research example, not a supplier quote.

Research reference: [WKO's 2026 example, pages 9–10](https://www.wko.at/oe/kollektivvertrag/lohnnebenkosten-gebauedereiniger-2026.pdf). WKO's example assumptions are not payroll tax rates for other countries.

## Storage and access

`/api/admin/international-costs` requires the existing `finance` permission for reads and writes. Mutations additionally require a trusted admin origin; a missing origin or Bearer-looking header does not bypass it. The input limit is 24 KB. Sources are HTTPS references and are never fetched by the service.

GET and server simulation do not create a table. The separate `international_cost_drafts` table is lazily created inside a successful save transaction. It stores only drafts, not pricing or booking records. Audit and save commit atomically. Client UUIDs and optimistic revisions make retries idempotent and prevent lost updates. Reads return at most 100 recent drafts, with private/no-store headers.

## Validation and release

Unit/API checks cover cost arithmetic, visit/team minima, VAT unknowns, margin and rounding, all 26 markets, Romanian parity, anonymous/client/operator/manager refusals, strict origin checks, retries, stale revisions, and rollback if auditing fails. Existing Romanian pricing, quote and managed-booking tests are included. Next build/i18n checks and an isolated browser preview use no production credentials or external transports.

An existing dashboard GET typing overload is made explicit to satisfy Next 16 generated route types while preserving no-argument unit callers; its implementation and authorization are unchanged.

Before any later commercial activation, require the partner's applicable payroll obligations, actual cost and billed-hours evidence, coverage, complete quote and validity, VAT and actual settlement capability. This PR supplies no activation path. No deployment, store submission, real notifications or financial operation is part of preparing it.

Rollback after a separately approved deployment is a code rollback to its parent. Drafts can remain dormant in their own table; do not delete them or alter existing job/price history.
