# NITIDO.RO — Design Handoff v2

SOURCE OF TRUTH: ZIP handoff supplied by OWNER on 2026-08-29. This specification is canonical for website + mobile UI/UX recreation. Preserve validated backend/security behavior; recreate visuals and interactions in the existing codebase.

## Product rule
Client posts a cleaning job. All eligible firms in the area are alerted simultaneously. The first eligible firm that presses Accept wins atomically on the server. Client immediately receives in-app notification + SMS with allocated firm. Exact address is visible only to the allocated firm after acceptance. Payment is held and released after completion confirmation.

## Fidelity
High-fidelity. Respect colors, typography, spacing, radii and copy. Image areas, avatars, firm logos and static map mockups are placeholders and must be replaced by real assets/SDKs. Use real line icons around 22x22, stroke about 1.75px.

## Core design tokens
- Brand green: #1B8A4C
- Dark green: #14663A
- Accent on dark: #39C97C
- Green label on dark: #8FD8AE
- Light green badge: #E4F0E8
- Light green section: #E9F2EC
- Ink: #101711
- Secondary text: #3E4842
- Muted: #5C6660 / #6B756F / #9AA39D
- Warm page background: #F4F3EE
- Alt/chip background: #EDECE6
- Surface: #FFFFFF
- Border: #E3E2DA
- Secondary border: #D8D7D0
- Dark background: #101711
- Dark surface: #18211A
- Dark surface 2: #232C25
- Dark border: #2A332C
- Dark text: #D3DAD5 / #A8B2AC / #8B958F
- Warning bg/text: #FBF1DC / #94620A
- Phone bezel: #0B0F0C

Typography: Instrument Sans 400/500/600/700. Hero 60px/1.04/700/-0.035em. Section H2 34px/700. Card/dashboard title 26px/700. Body 15–16px. Mobile functional minimum 14px.

Spacing: 4px scale. Web section horizontal 44px, vertical 64px. Mobile horizontal 22px. Grid gaps 16–20px.
Radii: buttons 10–14px, cards 16–18px, large panels 20px, pills 999px, phone bezel 52px outer / 42px inner.
Shadows: floating hero 0 18px 40px rgba(16,23,17,.16); desktop frame 0 24px 60px rgba(16,23,17,.10); phone 0 24px 60px rgba(16,23,17,.28).

# A. Website public — desktop 1440
Warm background #F4F3EE, centered content, 44px side padding.

1. Sticky nav ~66px, border-bottom #E3E2DA. Logo NITIDO.RO, .RO green. Links: Cum funcționează, Pentru clienți, Pentru firme, Prețuri, Despre noi, Contact. Auth secondary, Înregistrează-te primary green.

2. Hero: two-column 1.02fr/1fr, gap 48, padding 64/44/56. Badge: O singură regulă: primul care acceptă, ia lucrarea. H1: Postezi lucrarea. / Prima firmă care apasă Accept o ia. Accept green. Copy: NITIDO.RO conectează clienții care au nevoie de servicii de curățenie cu firme de încredere, într-un mod rapid, corect și transparent. CTA Postează o lucrare + Sunt firmă de curățenie. Trust row: Fără comisioane ascunse / Notificări în timp real / Suport dedicat. Right: 100% x 520 image r20 + floating Lucrare nouă card with 450–600 lei, countdown, Accept lucrarea, plus dark estimator card with area slider and 520 lei.

3. Cum funcționează: white section, 4 columns, #F4F3EE cards r16 p26.
- Postezi lucrarea
- Firmele sunt notificate + badge push la toate firmele
- Prima firmă acceptă + badge clientul primește SMS instant
- Lucrarea se realizează

4. Urmărire live: 0.9/1.1 grid. Right card with job title/status and timeline Acceptată 09:12 → Echipa a ajuns 10:04 → În lucru acum 6/9 pași → Confirmare est. 14:00. Before/after images.

5. Beneficii + Plăți: 3-column. Client benefits light-green; center payment trust with official payment brand chips and dark escrow card; firm benefits light-green.

6. Nitido Score: dark #101711 r20, score 94, bars punctualitate 98%, fără reclamații 95%, acte/asigurare Complet.

7. Pricing for firms: Start 99 lei/lună, Pro 249 lei/lună dark recommended, Teams ofertă. Pro includes priority notifications with 30 sec advance.

8. FAQ 2x2. 9. Dark footer 5 columns + legal row.

# B. Client dashboard — web 1440
236px sidebar. Active item #E9F2EC, text #14663A, r10. Content: Bună, Andrei; CTA Postează o lucrare; KPIs 3 in progress / 1 waiting / 5 completed / 4.8★. Jobs list with 40px thumbnails, meta, status badge, amount right. Right column dark card Lucrarea de azi / în lucru, timeline, 66% / 6 din 9 pași; escrow card 500 lei with completion confirmation disabled until complete.

# C. Mobile app — 390x844, 9 screens
Phone bezel #0B0F0C r52 padding 11, screen r42, status bar 9:41, 5-item tab bar h~74 + safe area 26.

1. Client Home: greeting/avatar; dark In lucru acum card with 66%, Urmărește / Mesaj; big Postează o lucrare; 2x2 quick services: Apartament de la 280, După renovare 450, Birou 350, Abonament -15%.
2. Post job step 3/4: 75% progress; type chips; area slider 120m2; GPS location map 124px, accuracy circle, green pin with white border, ±8m chip, exact address row + Adjust pin; note exact address only after acceptance; estimator 450–600; Continue CTA.
3. Firm feed dark: CleanPro SRL Score 94, 13 noi, filters; highlighted first card with green border, countdown, full-width Accept; later cards outline Accept.
4. Client live tracking: firm card + Call; checklist 6/9; before/after; bottom escrow 500 + Confirm finalization.
5. Messages: active status; firm white bubbles, client green bubbles; automatic update photo card; pill input + send.
6. Payment + review: completion check; recap 500 lei / platform fee 0 / total 500 / card ending 4218; 4/5 stars + chips; dark subscription -15%; submit review.
7. Firm push lock screen: dark wallpaper gradient, 66px time, white notification card with NITIDO icon, new job in Sector 1, details + budget, quick Accept / Details, countdown 11:20, grouped prior alerts.
8. Client allocation notification: dark card with exact timestamps, allocated to CleanPro SRL, accepted 1 sec after posting, Score 94 / 312 jobs, View firm / Message; real SMS text; earlier events show 4 firms notified and job posted.
9. Firm exact location map: 420px full-bleed map, floating controls, allocated chip, 4.2km/12min chip, recenter, exact pin/address + accuracy circle; bottom sheet with client, intercom/floor/lift, call, budget 450–600, escrow confirmed, Navigate + Am ajuns.

# Central behavior — MUST remain server authoritative
1. Client 4-step post flow; GPS while-in-use + manual pin/address.
2. Backend selects eligible firms: verified + active subscription + service radius; push simultaneously to all. Optional SMS fallback. Pro may get 30-sec notification priority per pricing rule.
3. First Accept wins atomically server-side; all others immediately get unavailable and card disappears.
4. Same second client gets in-app + SMS allocation. Preserve second-level timestamps.
5. Exact address hidden before accept; only allocated firm sees it after accept.
6. Firm navigates, marks arrived, checklist, before/after.
7. Client confirms complete → escrow release → review + recurring subscription offer.

Other behavior: visible expiration countdown ~11–12m; repost/increase budget if expired. Live estimator by type/area. 150–200ms hover/press transitions; 250ms sheet; 300ms progress. Skeleton loading. Firm empty state. GPS denied manual fallback. Push failure SMS fallback. Payment failure leaves waiting. Validation area 10–1000m2; coords required; budget min warning at 60% estimate. Responsive web: <1100 hero one column, <760 grids 4→2→1 and hamburger; client dashboard sidebar becomes tabs.

## State model
Client draftJob {type, areaSqm, address, coords, accuracyM, schedule, budgetMin, budgetMax, photos, notes, step}. jobs statuses open|assigned|in_progress|awaiting_confirmation|completed|cancelled|expired. Firm feed includes expiresAt, acceptedJobs, score, subscriptionPlan, serviceArea. Realtime events: new job, taken by another, status change, new message. Server is sole owner of first-Accept decision.

## Assets
No final photos included. Replace placeholders with real hero, before/after, avatars, firm logos. Replace static maps with real Google Maps / Mapbox / MapKit. Use official payment brand assets. Do not port prototype image-slot.js.

## Acceptance gate
Do not merge to main until visual review + security regression + tests/lint/build pass. No production deploy from this branch.