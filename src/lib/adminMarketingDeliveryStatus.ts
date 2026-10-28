export const MARKETING_DELIVERY_REASONS: Record<string,string> = {
 daily_quota_exceeded:'Limita zilnică a furnizorului este atinsă.',
 monthly_quota_exceeded:'Limita lunară a furnizorului este atinsă. Verifică planul înainte de reluare.',
 rate_limit_exceeded:'Furnizorul cere reducerea ritmului. Coada așteaptă reluarea.',
 provider_limit_unclassified:'Furnizorul a limitat expedierea. Mesajele rămân în coadă.',
 provider_configuration:'Furnizorul a refuzat autentificarea sau expeditorul. Verifică serviciul de email.',
 concurrent_idempotent_requests:'Cererea anterioară este încă procesată de furnizor.',
 invalid_idempotent_request:'Furnizorul a semnalat un conflict al cererii. Necesită verificare.',
 NETWORK_TIMEOUT:'Conexiunea cu furnizorul a expirat; acceptarea nu este confirmată.',
 NETWORK_ERROR:'Conexiunea cu furnizorul s-a întrerupt; acceptarea nu este confirmată.',
 UNCONFIRMED_RESPONSE:'Răspunsul furnizorului nu confirmă acceptarea mesajului.',
 TRANSPORT_UNCONFIRMED:'Acceptarea mesajului nu a putut fi confirmată.',
 WORKER_INTERRUPTED:'Procesarea a fost întreruptă înainte de înregistrarea rezultatului.',
 legacy_unconfirmed:'Rezultat neconfirmat din versiunea anterioară; motivul nu a fost înregistrat.',
 DEFINITIVE_REJECTION:'Mesaj refuzat de furnizor.',
};
export function marketingDeliveryReason(code:string){
 return MARKETING_DELIVERY_REASONS[code] ?? (/^PROVIDER_HTTP_[45]\d\d$/.test(code)?`Furnizorul a răspuns cu HTTP ${code.slice(-3)}.`:'Rezultatul necesită verificare.');
}
export type MarketingProviderHold={code:string;message:string;retryAt:string|null;failures:number};
