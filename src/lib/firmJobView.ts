// Client pricing and platform margins stay outside partner responses.
const privatePricing = new Set(['price_gross','pricing_snapshot','credit_applied','express_60_fee','commission','commission_amount','platformFee']);
export function firmJobView<T extends object>(job:T):Omit<T,'price_gross'|'pricing_snapshot'|'credit_applied'|'express_60_fee'> {
 return Object.fromEntries(Object.entries(job).filter(([key])=>!privatePricing.has(key))) as Omit<T,'price_gross'|'pricing_snapshot'|'credit_applied'|'express_60_fee'>;
}
