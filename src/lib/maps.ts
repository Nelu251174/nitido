import { JobRow } from "@/lib/types";

/**
 * Construiește adresa completă a unei lucrări, pentru afișare sau geocodare.
 */
export function fullAddress(job: Pick<JobRow, "street" | "city" | "postal_code">): string {
  return [job.street, job.city, job.postal_code].filter(Boolean).join(", ");
}

/**
 * Link Google Maps cu traseu (directions) către adresa lucrării, în modul șofer.
 * Nu necesită cheie API — Google Maps calculează și afișează singur ruta,
 * durata estimată (ETA) și distanța în km imediat ce se deschide linkul,
 * fie în aplicația Google Maps (mobil), fie în browser.
 */
export function mapsDirectionsUrl(job: Pick<JobRow, "street" | "city" | "postal_code">): string {
  const destination = encodeURIComponent(fullAddress(job));
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}
