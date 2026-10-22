import {afterEach,expect,it,vi} from 'vitest';
import {managedBookingEnabled} from './bookingQuotes';
import {manualOffersEnabled} from './manualOffers';
import {manualOfferBookingEnabled} from './manualOfferBooking';

afterEach(()=>vi.unstubAllEnvs());
function configure(key:string,host='https://sandbox.nitido.ro'){
 vi.stubEnv('STRIPE_SECRET_KEY',key);vi.stubEnv('NEXT_PUBLIC_SITE_URL',host);
 for(const flag of ['NITIDO_MANAGED_PRICING_SANDBOX','NITIDO_MANUAL_OFFERS_SANDBOX','NITIDO_MANUAL_OFFER_BOOKING_SANDBOX'])vi.stubEnv(flag,'true');
}
const gates=()=>[managedBookingEnabled(),manualOffersEnabled(),manualOfferBookingEnabled()];
it.each(['sk_live_synthetic','rk_live_synthetic'])('keeps every experimental financial path disabled with %s despite all sandbox flags',key=>{
 configure(key);expect(gates()).toEqual([false,false,false]);
});
it.each(['sk_test_synthetic','rk_test_synthetic'])('allows the explicitly configured existing sandbox with %s',key=>{
 configure(key);expect(gates()).toEqual([true,true,true]);
});
it.each(['sk_test_synthetic','rk_test_synthetic','sk_live_synthetic','rk_live_synthetic'])('never enables an experimental financial path on the production host with %s',key=>{
 configure(key,'https://nitido.ro');expect(gates()).toEqual([false,false,false]);
});
it('does not infer activation from test credentials alone',()=>{
 configure('rk_test_synthetic');
 for(const flag of ['NITIDO_MANAGED_PRICING_SANDBOX','NITIDO_MANUAL_OFFERS_SANDBOX','NITIDO_MANUAL_OFFER_BOOKING_SANDBOX'])vi.stubEnv(flag,'false');
 expect(gates()).toEqual([false,false,false]);
});
