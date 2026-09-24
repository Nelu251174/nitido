import { publicPageMetadata } from "@/lib/publicSeo";
export const metadata = publicPageMetadata("/incredere");
import { db } from "@/lib/db";
import { getPublicTrustSnapshot } from "@/lib/reviews";
import { SiteFooter,SiteHeader } from "@/components/SiteChrome";
import { VerifiedReviews } from "@/components/VerifiedReviews";
export const dynamic="force-dynamic";
const sections = [
  [
    "Ce înseamnă o firmă verificată",
    "Verificarea disponibilă în platformă privește datele firmei, CUI-ul și starea confirmată prin sursa de verificare. Consultă profilul împreună cu zona de acoperire și istoricul lucrărilor. Statutul verificat nu înseamnă că fiecare angajat a fost certificat de NITIDO și nu înlocuiește evaluarea potrivirii pentru serviciul tău. Pentru cerințe speciale, clarifică experiența și resursele necesare înainte de intervenție. Nu prezentăm calificări sau asigurări care nu au fost confirmate."
  ],
  [
    "Cum interpretezi recenziile",
    "Recenziile verificate sunt asociate lucrărilor reale finalizate prin NITIDO. Citește comentariile împreună cu numărul evaluărilor: o medie bazată pe puține lucrări oferă mai puțin context decât un istoric mai amplu. O evaluare utilă descrie serviciul primit, punctualitatea și comunicarea. Nu publicăm cifre demonstrative ca rezultate reale. Dacă o recenzie conține date personale sau informații pe care le consideri necorespunzătoare, semnalează problema pentru analiză."
  ],
  [
    "De ce sunt cerute dovezi foto",
    "Fotografiile de sosire și finalizare documentează etapele cerute în fluxul lucrării. Ele ajută la înțelegerea situației și la analizarea eventualelor diferențe, dar nu pot demonstra singure fiecare detaliu al calității. Imaginile trebuie să provină de la lucrarea respectivă și să evite documente, persoane sau obiecte private fără legătură cu intervenția. Dacă rezultatul nu corespunde serviciului rezervat, descrie problema concret și transmite dovezile relevante suportului."
  ],
  [
    "Neprezentări și responsabilitate",
    "O lucrare acceptată presupune respectarea programării și comunicarea impedimentelor. Incidentele confirmate de neprezentare pot influența istoricul firmei și pot conduce la restricții potrivit regulilor platformei. Dacă echipa nu ajunge, păstrează datele programării și cere verificarea situației. Nu presupune automat că rezervarea s-a anulat sau că o sumă blocată a fost deja eliberată; verifică starea lucrării și a plății în cont."
  ],
  [
    "Cum verifici plata",
    "Autorizarea rezervă o sumă, iar capturarea reprezintă încasarea ei prin procesator. Fluxul de plată este legat de etapele valide ale lucrării. NITIDO nu cere numărul complet al cardului prin mesaje sau prin Asistentul AI. Pentru diferențe între cont și extras, transmite identificatorul lucrării și descrierea operațiunii, fără date bancare sensibile. Afișarea unei eliberări sau a unei rambursări poate depinde de procesator și de bancă."
  ],
  [
    "Adresa exactă și accesul la spațiu",
    "Înainte de alocare, firmele văd informațiile generale necesare pentru a decide dacă pot executa serviciul. După confirmarea firmei responsabile, aceasta primește detaliile autorizate de acces. Datele trebuie folosite pentru lucrare, nu distribuite ori reutilizate în alte scopuri. Verifică informațiile introduse și evită publicarea codurilor de acces în descrieri generale. În NITIDO Pro, accesul operațional este legat de rolul și de fereastra autorizată a lucrării."
  ],
  [
    "Cine alege firma: Standard și Express",
    "La Standard, clientul alege dintre firmele care au trimis candidaturi. La Express, preluarea se face prin prima acceptare eligibilă confirmată. Acestea sunt două mecanisme diferite, iar o notificare nu confirmă singură alocarea. Verifică firma și starea în cont înainte de deplasare sau de pregătirea accesului. Sistemul verifică disponibilitatea lucrării astfel încât aceasta să nu fie atribuită simultan mai multor firme."
  ],
  [
    "Cum soliciți ajutor pentru o problemă concretă",
    "Asistentul AI poate explica pașii și informațiile permise din cont, dar nu hotărăște plăți sau reclamații. Pentru intervenție umană, contactează 0341.402.403 sau contact@nitido.ro. Include identificatorul lucrării, ce s-a întâmplat, când ai observat problema și ce clarificare soliciți. Păstrează mesajele relevante și ascunde datele inutile din capturi. O cerere de suport nu reprezintă, în sine, confirmarea unei anulări sau rambursări."
  ]
] as const;
export default function TrustPage(){const snapshot=getPublicTrustSnapshot(db);return <main className="bg-[#f7f9fc] text-[#111827]"><SiteHeader/><section className="v2-container py-20 max-md:py-12"><div className="max-w-4xl"><div className="v2-eyebrow">ÎNCREDERE &amp; SIGURANȚĂ</div><h1 className="mt-5 text-[clamp(42px,6vw,72px)] font-bold leading-[1.03] tracking-[-.045em]">Încrederea se construiește prin dovezi, nu prin promisiuni.</h1><p className="mt-7 max-w-3xl text-lg leading-8 text-[#3e4842]">NITIDO combină verificarea firmelor, lucrările reale, dovezile foto, ratingurile și istoricul operațional pentru a crea un marketplace mai transparent pentru clienți și firme.</p></div><div className="mt-16 grid grid-cols-2 gap-5 max-md:grid-cols-1">{sections.map(([title,text],index)=><article className={`rounded-[22px] border border-[#e2e8f0] p-7 ${index%3===0?"bg-white":"bg-[var(--nitido-brand-soft)]"}`} key={title}><span className="text-xs font-bold text-[var(--nitido-brand-dark)]">{String(index+1).padStart(2,"0")}</span><h2 className="mt-4 text-2xl font-bold">{title}</h2><p className="mt-4 leading-7 text-[#4d5751]">{text}</p></article>)}</div></section><VerifiedReviews reviews={snapshot.reviews}/><SiteFooter/></main>}
