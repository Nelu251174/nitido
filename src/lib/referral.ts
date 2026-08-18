/**
 * Program de recomandare ("adu un prieten") — inspirat din motorul de
 * creștere clasic al piețelor cu doi versanți (Uber, Airbnb, Helpling):
 * cel care recomandă și cel recomandat primesc amândoi un credit în lei,
 * folosit ca reducere la următoarea lucrare postată.
 *
 * V1, simplu și verificabil: creditul se acordă imediat la înregistrare,
 * nu abia după prima lucrare finalizată a celui recomandat — mai ușor de
 * testat cap-coadă acum; poate fi înăsprit ulterior (acordare doar după
 * prima lucrare finalizată) dacă apar abuzuri reale.
 */

export const REFERRAL_BONUS_LEI = 20;

/**
 * Generează un cod de recomandare lizibil, pe baza numelui — ex. "ANA-4X7Q".
 * Nu garantează unicitate matematic; apelantul verifică împotriva bazei de
 * date și regenerează la nevoie (coliziune extrem de improbabilă).
 */
export function generateReferralCode(name: string): string {
  const prefix = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 4) || "NIT";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}

/**
 * Calculează prețul final după aplicarea creditului disponibil — reducerea
 * nu poate depăși prețul brut (nu oferim lucrări "negative") și consumă din
 * credit exact cât s-a folosit efectiv.
 */
export function applyCredit(
  priceGross: number,
  creditBalance: number
): { finalPrice: number; creditUsed: number } {
  const creditUsed = Math.max(0, Math.min(creditBalance, priceGross));
  return { finalPrice: priceGross - creditUsed, creditUsed };
}
