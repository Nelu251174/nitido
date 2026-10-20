import {calcNetForFirm} from './pricing';

export const CREDIT_POLICY_VERSION='platform-share-only-2026-10-20-v1';
export const CREDIT_POLICY_NOTICE='Creditul se aplică până la partea disponibilă a platformei pentru această rezervare. Suma nefolosită rămâne în cont; remunerația firmei nu se reduce.';
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
 * este finanțată doar din partea platformei (nu din partea firmei) și consumă din
 * credit exact cât s-a folosit efectiv.
 */
export function applyCredit(
  priceGross: number,
  creditBalance: number
): { finalPrice: number; creditUsed: number } {
  if(!Number.isFinite(priceGross)||priceGross<0||!Number.isFinite(creditBalance))throw Error("Valori de credit invalide");
  const available=Math.round(Math.max(0,priceGross-calcNetForFirm(priceGross))*100)/100;
  const creditUsed=Math.round(Math.max(0,Math.min(creditBalance,available))*100)/100;
  return { finalPrice: Math.round((priceGross-creditUsed)*100)/100, creditUsed };
}
