import {NextRequest,NextResponse} from 'next/server';
import {siteIndexingEnabled} from './lib/siteIndexing';
import {visitorCountry} from './lib/visitorCountry';
const privatePaths=['/pro','/api','/admin','/client','/firma','/login','/signup','/mobile','/colaborari','/echipa','/invitatie','/remedieri','/reset-password','/verify-email','/reset-parola','/confirma-email','/uploads','/card-finalizat','/cont'];
export function proxy(req:NextRequest){
 const host=req.headers.get('host')?.toLowerCase();
 const publicHost=host==='nitido.ro'||host==='www.nitido.ro';
 const privatePath=privatePaths.some(p=>req.nextUrl.pathname===p||req.nextUrl.pathname.startsWith(p+'/'));
 const forwarded=new Headers(req.headers);
 // Never trust a caller-provided country. Resolve locally, without sending IPs
 // to a translation/geolocation service. A manual language choice wins.
 forwarded.delete('x-nitido-country');
 forwarded.delete('x-nitido-original-currency');
 if(req.nextUrl.pathname==='/admin'||req.nextUrl.pathname.startsWith('/admin/'))forwarded.set('x-nitido-original-currency','true');
 const pageRequest=!req.nextUrl.pathname.startsWith('/api/') && !/\.[a-z0-9]+$/i.test(req.nextUrl.pathname);
 if(pageRequest){
   const country=visitorCountry(req.headers);
   if(country)forwarded.set('x-nitido-country',country);
 }
 const response=NextResponse.next({request:{headers:forwarded}});
 if(pageRequest){
   response.headers.set('Cache-Control','private, no-store');
   response.headers.set('Vary','Accept-Language, Cookie');
 }
 if(!siteIndexingEnabled()||!publicHost||privatePath)response.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
 return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
