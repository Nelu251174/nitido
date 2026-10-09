# Reconcilierea istoriei main cu candidatul NITIDO v1.1

## Baza verificată

- Candidat: `97938ad4f58f7d5a890cae0c1cc7dbd00dceec0f` (PR #86 peste #85).
- Main verificat local: `2101988542d989b46cb2c091922d16ddce334387`.
- Strămoș comun: `a6d9b239b08896dad65898b7111487a6c3a49375`.
- Diferență de istorie: 8 commituri numai în main, 322 numai în candidat.
- Merge pregătit numai în worktree izolat; nu este commituit și nu a modificat main sau deployment. Toate conflictele folosesc conținutul candidatului; nu s-au reactivat NEXUS sau aliasuri Stripe.

## Intențiile celor 8 commituri numai în main

| Commit | Intenție și căi relevante | Reconciliere |
|---|---|---|
| `b1d02da` | Robots/sitemap, metadata publică și legală, JSON-LD acasă, `signup/layout.tsx` | Candidatul păstrează SEO prin `publicSeo.ts`, sitemap/robots cu activare explicită numai pe domeniul LIVE, JSON-LD și metadata paginilor legale actualizate. Layoutul vechi signup este exclus: canonicalul/indexarea de conversie sunt contrare separării public/privat actuale. |
| `283c8d4` | Ignorarea dependințelor, datelor, uploadurilor, cheilor locale; lockfile | Păstrat `.gitignore` din candidat și adăugate protecțiile lipsă pentru fișiere locale `.pem`, `.env*.local`, artefacte PnP/build/coverage/TypeScript. Merge automat al lockfile adaugă numai `hasInstallScript:true` la better-sqlite3 13.0.3; versiunea și integritatea rămân identice. |
| `78616c1` | Orașe SEO, imagine OG, manifest PWA, verificare Google din env | Orașele și manifestul din candidat păstrează funcțiile cu designul cream aprobat; verificarea Google este păstrată. Imaginea OG lipsește din candidat: trebuie readusă în designul actual, fără vechea promisiune Express universală. |
| `a348f15` | Onboarding Stripe Connect și afișarea stării firmei | Candidatul are implementarea production-baseline `/api/stripe/connect/onboarding`, idempotency și verificări de capabilități, UI operațional și schema firmelor extinsă. Nu se readuce implementarea Stripe veche, nici algoritmul comercial vechi. Aliasul URL `/api/firms/stripe/onboard` este o opțiune de compatibilitate, dacă se confirmă necesitatea. |
| `317f25c` | Merge PR #4 pentru onboarding Stripe | Nu adaugă o intenție diferită față de `a348f15`; implementarea production-baseline rămâne sursa. |
| `f39ded3` | Contor NEXUS solicitat de OWNER: script `https://nexus.nexuscompany.ro/b.js`, `data-site=nitido.ro`, declarație confidențialitate | Intenția lipsește în candidat. Necesită readucerea contorului și a declarației în layout/politica actuală, fără a înlocui paginile/designul. Commit OWNER datat 19 septembrie 2026 14:18:39+03, integrat prin #51 la 14:30:44+03. Nu există commit de eliminare în istoria candidatului: commitul de adăugare nu este strămoș al acestuia. Politica actuală de cookie-uri și testul `siteContent.test.ts` descriu absența analytics; nu a fost identificat un controller general de consimțământ. Serviciul extern și sursa activă LIVE nu sunt verificate de acest audit, deci contorul nu este reactivat automat. |
| `8125536` | Merge PR #51 pentru contor NEXUS | Aceeași intenție ca `f39ded3`. |
| `2101988` | Pro P0: pagini, leaduri, schema și devize cu membership legacy | Funcțiile sunt depășite de Pro v1.1: `pro_members`, `pro_leads(name,email,phone,...)`, revizii/aprobări/snapshoturi, portofolii, dovezi și delegare. Modulele/API P0 nu pot fi reunite: folosesc `contact_name`, `pro_memberships`, aprobări și override incompatibile. Se păstrează numai eventualele aliasuri publice utile, fără a introduce tabele sau handlers legacy. |

## Rezolvarea celor 21 conflicte

Conținutul production-baseline din candidat se păstrează în:

- `.gitignore` (cu unirea protecțiilor locale descrisă mai sus).
- `src/app/api/auth/me/route.ts`, `src/app/firma/page.tsx`, `src/lib/db.ts`, `src/lib/stripeConnect.ts`, `src/lib/useCurrentUser.ts`: autentificare și firmă/Stripe evoluate, fără revenire la varianta veche.
- `src/app/layout.tsx`, paginile `confidentialitate`, `cookie-uri`, `termeni`, `page.tsx`: designul actual, informațiile legale și metadata curente; NEXUS se adaugă separat dacă este reconciliat.
- `src/app/curatenie/[oras]/page.tsx`, `src/lib/cities.ts`, `src/app/manifest.ts`, `src/app/robots.ts`, `src/app/sitemap.ts`: design/politici publice actuale, fără promisiuni vechi sau indexare sandbox.
- `src/app/nitido-pro/page.tsx`, `src/app/parteneri-pro/page.tsx`, `src/lib/pro/schema.ts`, `src/instrumentation.ts`: Pro v1.1 și migrări explicite. Nu se execută `pro/init`/DDL din request sau startup.

## Adăugările automate care trebuie excluse sau adaptate

Merge-ul fără conflicte ar readuce 17 căi vechi. Rezolvarea le exclude inițial și permite numai reintroduceri explicite după audit:

- `docs/NITIDO_PRO_P0.md`: document istoric depășit, inclusiv o recomandare DROP incompatibilă cu păstrarea datelor. Rămâne accesibil în istoricul Git.
- `src/lib/pro/{audit,authz,init,leads,quotes,status,status.test}.ts` și `src/app/api/pro/leads/{clients,partners}/route.ts`, `src/app/api/pro/quotes/[id]/{decide,override}/route.ts`: implementări incompatibile cu schema/drepturile/snapshoturile actuale.
- `src/app/signup/layout.tsx`: vechi canonical public, exclus în favoarea policy actuale.
- `src/app/opengraph-image.tsx`: trebuie adaptată la designul cream.
- `src/app/nitido-pro/multumim/page.tsx`, `src/app/parteneri-pro/multumim/page.tsx`: pot fi păstrate ca pagini de compatibilitate; nu trebuie să afirme un lead creat pe baza simplei accesări URL.
- `src/app/api/firms/stripe/onboard/route.ts`: poate fi alias către handlerul actual, fără reintroducerea implementării Stripe anterioare.

## Limite

Acesta este audit de cod/istorie. Nu validează datele sau sursa efectivă din Coolify/LIVE. Integrarea main/publicarea cer teste ale arborelui final, inventarul real al țintei, backup DB+uploaduri și revenire verificabilă. Nu s-au efectuat plăți, resetări de chei, ștergeri de date sau publicări.

## Compatibilitatea datelor trebuie verificată separat

Main P0 importa `pro/init` în `src/instrumentation.ts`; `src/lib/pro/schema.ts` rula `initProSchema()` la încărcare. Dacă acel main a fost publicat, chiar și un startup fără leaduri poate fi suficient pentru crearea tabelelor P0. Pro v1.1 refuză corect tabelele legacy fără `pro_schema_migrations` recunoscut. Nu se ocolește refuzul prin DROP sau prin forțarea versiunii. Se inventariază schema țintei și, dacă este P0, se pregătește separat o migrare fără pierderea istoricului. Sursa production-baseline documentată `9cbc593` nu conține commitul main P0 `2101988`; nu dovedește însă ce este publicat acum.
