export const HERO_JOB_SCHEDULED_AT = "2026-08-30T11:24:00+03:00";

const HERO_TIME_ZONE = "Europe/Bucharest";

export function formatHeroJobDate(value = HERO_JOB_SCHEDULED_AT) {
  const date = new Date(value);
  return {
    compactDate: new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: HERO_TIME_ZONE }).format(date),
    longDate: new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long", year: "numeric", timeZone: HERO_TIME_ZONE }).format(date),
    time: new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: HERO_TIME_ZONE }).format(date),
  };
}
