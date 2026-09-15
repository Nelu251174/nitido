// Tarif NITIDO din 15.09.2026; fundamentare în docs/pricing-2026-09-15.md.
// Funcții pure, testabile independent de bază de date sau server.

export type SpaceType = "apartament" | "casa" | "birou" | "altul";

// Maximum area supported by the existing automatic booking calculator.
export const AUTOMATIC_MAX_SQM = 1000;

export const PLATFORM_COMMISSION = 0.18; // 18% comision platformă, fix — spec secțiunea 7

export const SLOT_HOURS = [8, 10, 12, 14, 16, 18] as const;
export const MIN_LEAD_HOURS = 1; // prag minim obligatoriu (anunț minim înainte de ora programată) — spec secțiunea 5d
export const BUFFER_MINUTES = 30; // buffer obligatoriu între lucrări consecutive — spec secțiunea 5d

export const APARTMENT_TIERS: { max: number; price: number }[] = [
  { max: 40, price: 350 },
  { max: 60, price: 450 },
  { max: 80, price: 550 },
  { max: 100, price: 650 },
];

export const PER_SQM_RATES: Record<Exclude<SpaceType, "apartament">, number> = {
  casa: 7,
  birou: 5,
  altul: 6,
};

export const MINIMUM_PRICES = {casa:350,birou:250,altul:300} as const;
export const WINDOWS_RATE_LEI = 8;
export const WINDOWS_MAX_SQM = 200;
export const PRICING_VERSION = 'nitido-2026-09-15-v2';
/** Glass area is measured once. Price includes both accessible faces and frames. */
export function validWindowsSqm(value:unknown):value is number {
  return typeof value==='number' && Number.isSafeInteger(value) && value>=0 && value<=WINDOWS_MAX_SQM;
}
export function calcWindowsPrice(sqm:number=0):number {
  if(!validWindowsSqm(sqm))throw new Error('Suprafața geamurilor trebuie să fie între 0 și 200 m², fără zecimale');
  return sqm*WINDOWS_RATE_LEI;
}
export function calcServicePrice(type:SpaceType,sqm:number,windowsSqm=0){return calcGrossPrice(type,sqm)+calcWindowsPrice(windowsSqm);}
export function calcServiceDuration(sqm:number,windowsSqm=0){
  calcWindowsPrice(windowsSqm);
  return calcDurationMinutes(sqm)+(windowsSqm?Math.ceil(windowsSqm/5)*15:0);
}
export function priceExplanation(type:SpaceType,sqm:number):string {
  if(type==='apartament'){
    const tier=APARTMENT_TIERS.find(t=>sqm<=t.max);
    return tier?`Pachet până la ${tier.max} m²: ${tier.price} lei`:'650 lei pentru primii 100 m² + 6,50 lei/m² peste 100 m²';
  }
  return `${PER_SQM_RATES[type]} lei/m² · minimum ${MINIMUM_PRICES[type]} lei/intervenție`;
}

/**
 * Calculează prețul BRUT (ce plătește clientul), pe baza tipului de spațiu și suprafeței.
 * Apartament: trepte fixe. Restul: preț/mp. — spec secțiunea 6.
 */
export function calcGrossPrice(spaceType: SpaceType, sqm: number): number {
  if (!Number.isFinite(sqm) || sqm <= 0) throw new Error("Suprafața trebuie să fie pozitivă");

  if (spaceType === "apartament") {
    const tier = APARTMENT_TIERS.find((t) => sqm <= t.max);
    if (tier) return tier.price;
    // peste 100 mp: +6,5 lei/mp suplimentar față de treapta de 650 lei
    return Math.round(650 + (sqm - 100) * 6.5);
  }

  if (!(spaceType in PER_SQM_RATES)) throw new Error("Tip de spațiu invalid");
  return Math.max(MINIMUM_PRICES[spaceType], Math.round(sqm * PER_SQM_RATES[spaceType]));
}

/**
 * Suma netă pe care o vede/încasează firma — preț brut minus comisionul platformei.
 * Calculul se face O SINGURĂ DATĂ, server-side — spec secțiunea 7 (regulă critică de UX/audit).
 */
export function calcNetForFirm(grossPrice: number): number {
  return Math.round(grossPrice * (1 - PLATFORM_COMMISSION));
}

/**
 * Durata estimată a lucrării (minute), pe baza suprafeței — spec secțiunea 5d.
 * NU include buffer-ul — buffer-ul se adaugă separat la blocarea calendarului.
 */
export function calcDurationMinutes(sqm: number): number {
  if (!Number.isFinite(sqm) || sqm <= 0) throw new Error("Suprafața trebuie să fie pozitivă");
  if (sqm <= 40) return 90;
  if (sqm <= 60) return 120;
  if (sqm <= 80) return 150;
  if (sqm <= 100) return 180;
  const extraChunks = Math.ceil((sqm - 100) / 40);
  return 180 + extraChunks * 30;
}

/** Intervalul complet blocat în calendarul firmei: durată + buffer obligatoriu. */
export function calcBlockedMinutes(sqm: number): number {
  return calcDurationMinutes(sqm) + BUFFER_MINUTES;
}

/** Verifică dacă un slot respectă pragul minim de MIN_LEAD_HOURS ore față de momentul curent. */
export function isSlotValid(slotDate: Date, hour: number, now: Date = new Date()): boolean {
  const slotTime = new Date(slotDate);
  slotTime.setHours(hour, 0, 0, 0);
  const diffHours = (slotTime.getTime() - now.getTime()) / 3_600_000;
  return diffHours >= MIN_LEAD_HOURS;
}

/**
 * Verifică dacă un nou interval [start, start+blockedMinutes) se suprapune cu
 * intervalele deja ocupate ale firmei — spec secțiunea 5d, punctul 2 ("impact tehnic").
 */
export function overlapsExisting(
  newStart: Date,
  blockedMinutes: number,
  existing: { start: Date; blockedMinutes: number }[]
): boolean {
  const newEnd = new Date(newStart.getTime() + blockedMinutes * 60_000);
  return existing.some((slot) => {
    const slotEnd = new Date(slot.start.getTime() + slot.blockedMinutes * 60_000);
    return newStart < slotEnd && slot.start < newEnd;
  });
}

/** Găsește primul slot valid ("Cât mai curând") în următoarele 3 zile. */
export function nextValidAsapSlot(now: Date = new Date()): { date: Date; hour: number } | null {
  for (let d = 0; d < 3; d++) {
    const day = new Date(now);
    day.setDate(day.getDate() + d);
    day.setHours(0, 0, 0, 0);
    for (const h of SLOT_HOURS) {
      if (isSlotValid(day, h, now)) {
        return { date: day, hour: h };
      }
    }
  }
  return null;
}

export function formatInterval(start: Date, blockedMinutes: number): string {
  const end = new Date(start.getTime() + blockedMinutes * 60_000);
  const fmt = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${fmt(start)} - ${fmt(end)}`;
}
