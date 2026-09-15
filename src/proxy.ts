import {NextRequest,NextResponse} from 'next/server';
import {siteIndexingEnabled} from './lib/siteIndexing';
const privatePaths=['/api','/admin','/client','/firma','/login','/signup','/mobile','/colaborari','/echipa','/invitatie','/remedieri','/reset-password','/verify-email','/reset-parola','/confirma-email','/uploads'];
export function proxy(req:NextRequest){
 const host=req.headers.get('host')?.toLowerCase();
 const publicHost=host==='nitido.ro'||host==='www.nitido.ro';
 const privatePath=privatePaths.some(p=>req.nextUrl.pathname===p||req.nextUrl.pathname.startsWith(p+'/'));
 const response=NextResponse.next();
 if(!siteIndexingEnabled()||!publicHost||privatePath)response.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
 return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
