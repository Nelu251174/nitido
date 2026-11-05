import {NextRequest,NextResponse} from 'next/server';
import {getCurrentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {bucharestDay,earningsForMonth,earningTotals} from '@/lib/monthlyFirmEarnings';
export async function GET(req:NextRequest){
 const user=await getCurrentUser(req);const headers={'Cache-Control':'private, no-store'};
 if(!user||user.role!=='firma')return NextResponse.json({error:'Autentificare ca firmă necesară'},{status:401,headers});
 const month=req.nextUrl.searchParams.get('month')??bucharestDay(new Date().toISOString()).slice(0,7);
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))return NextResponse.json({error:'Lună invalidă'},{status:400,headers});
 const rows=earningsForMonth(db,user.id,month),byCurrency=earningTotals(rows);
 return NextResponse.json({month,rows,total:byCurrency.RON,totalCurrency:'RON',byCurrency},{headers});
}
