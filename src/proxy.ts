import {NextRequest,NextResponse} from 'next/server';
import {siteIndexingEnabled} from './lib/siteIndexing';
import {lookup} from 'geoip-country';
import {asLocale, hasSupportedLanguage, LOCALE_COOKIE} from './i18n/locales';
const privatePaths=['/pro','/api','/admin','/client','/firma','/login','/signup','/mobile','/colaborari','/echipa','/invitatie','/remedieri','/reset-password','/verify-email','/reset-parola','/confirma-email','/uploads','/card-finalizat','/cont'];
export function proxy(req:NextRequest){
 const host=req.headers.get('host')?.toLowerCase();
 const publicHost=host==='nitido.ro'||host==='www.nitido.ro';
 const privatePath=privatePaths.some(p=>req.nextUrl.pathname===p||req.nextUrl.pathname.startsWith(p+'/'));
 const forwarded=new Headers(req.headers);
 // Never trust a caller-provided country. Resolve locally, without sending IPs
 // to a translation/geolocation service. Cookies and language headers win.
 forwarded.delete('x-nitido-country');
 const pageRequest=!req.nextUrl.pathname.startsWith('/api/') && !/\.[a-z0-9]+$/i.test(req.nextUrl.pathname);
 if(!asLocale(req.cookies.get(LOCALE_COOKIE)?.value) && !hasSupportedLanguage(req.headers.get('accept-language')) &&
    !req.nextUrl.pathname.startsWith('/api/') && !/\.[a-z0-9]+$/i.test(req.nextUrl.pathname)){
   const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
   try {const country=ip?lookup(ip)?.country:null;if(country)forwarded.set('x-nitido-country',country);} catch { /* Country lookup is best effort. */ }
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
