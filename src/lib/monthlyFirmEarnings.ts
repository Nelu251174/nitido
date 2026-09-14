import type {Database} from 'better-sqlite3';
export const utcDate=(value:string)=>new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value)?value:value.replace(' ','T')+'Z');
export const bucharestDay=(value:string)=>{const d=utcDate(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).format(d):'';};
export type EarningRow={id:string;clientName:string;street:string;city:string;completedAt:string;arrivedAt:string|null;estimatedMinutes:number;net:number|null;paymentStatus:string|null;refundStatus:string|null;disputeStatus:string|null;transferStatus:string|null;payoutStatus:string|null;day:string;recordedMinutes:number|null;confirmedNet:number};
export function earningsForMonth(db:Database,userId:string,month:string):EarningRow[]{
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Lună invalidă');
 const [year,m]=month.split('-').map(Number),start=new Date(Date.UTC(year,m-1,0)).toISOString(),end=new Date(Date.UTC(year,m,2)).toISOString();
 const rows=db.prepare(`SELECT j.id,u.name AS clientName,j.street,j.city,j.completed_at AS completedAt,j.arrived_confirmed_at AS arrivedAt,j.duration_minutes AS estimatedMinutes,
 p.amount_net AS net,p.status AS paymentStatus,p.refund_status AS refundStatus,p.dispute_status AS disputeStatus,p.transfer_status AS transferStatus,p.payout_status AS payoutStatus
 FROM jobs j JOIN firms f ON f.id=j.accepted_firm_id JOIN users u ON u.id=j.client_id LEFT JOIN payments p ON p.job_id=j.id
 WHERE f.user_id=? AND j.status='completed' AND datetime(j.completed_at)>=datetime(?) AND datetime(j.completed_at)<datetime(?) ORDER BY j.completed_at DESC,j.id DESC`).all(userId,start,end) as Omit<EarningRow,'day'|'recordedMinutes'|'confirmedNet'>[];
 return rows.map(row=>{const minutes=row.arrivedAt?(utcDate(row.completedAt).getTime()-utcDate(row.arrivedAt).getTime())/60000:NaN;return {...row,day:bucharestDay(row.completedAt),recordedMinutes:Number.isFinite(minutes)&&minutes>=0?Math.round(minutes):null,confirmedNet:row.paymentStatus==='captured'&&row.refundStatus==='none'&&row.disputeStatus==='none'?row.net??0:0};}).filter(row=>row.day.startsWith(month));
}
