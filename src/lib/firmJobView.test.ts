import {it,expect} from 'vitest';
import {firmJobView} from './firmJobView';
it('keeps partner payout and execution data without client pricing or margin',()=>{
 const original={id:'job',status:'accepted',price_gross:550,pricing_snapshot:'private',credit_applied:10,express_60_fee:79,commission_amount:99,firm_payout:451,financial:{firmPayout:451,paymentStatus:'authorized'}};
 const view=firmJobView(original);
 expect(view).toEqual({id:'job',status:'accepted',firm_payout:451,financial:{firmPayout:451,paymentStatus:'authorized'}});
 expect(original.price_gross).toBe(550);
});
