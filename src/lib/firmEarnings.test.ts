import {describe,it,expect} from 'vitest';
import {firmEarnings} from './firmEarnings';
import type {JobRow} from './types';
const completed={id:'a',status:'completed',completed_at:'2026-09-10T22:30:00Z',financial:{paymentStatus:'captured',firmPayout:450,transferStatus:'pending',payoutStatus:'pending',refundStatus:'none',disputeStatus:'none'}} as JobRow;
describe('firm earnings presentation',()=>{
 it('uses Romanian completion day and net captured value, not gross or authorization',()=>{const r=firmEarnings([completed,{...completed,id:'b',financial:{...completed.financial!,paymentStatus:'authorized'}}],new Date('2026-09-11T10:00:00Z'));expect(r.total).toBe(450);expect(r.days.at(-1)).toMatchObject({key:'2026-09-11',amount:450});expect(r.latest?.id).toBe('a');expect(r.latest?.financial?.payoutStatus).toBe('pending')});
 it('excludes refunds, disputes and missing settlement amounts',()=>{const rows=[{...completed,financial:{...completed.financial!,refundStatus:'succeeded'}},{...completed,financial:{...completed.financial!,disputeStatus:'open'}},{...completed,financial:{...completed.financial!,firmPayout:undefined}}];expect(firmEarnings(rows,new Date('2026-09-11')).total).toBe(0)});
});
