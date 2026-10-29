import {NextRequest,NextResponse} from 'next/server';
import {visitorCountry} from '@/lib/visitorCountry';
import {currencyForCountry} from '@/lib/displayCurrency';
import {getEuroReferenceRate} from '@/lib/euroReferenceRate';
import {LOCALE_COOKIE,selectLocale} from '@/i18n/locales';
export async function GET(req:NextRequest){
 const country=visitorCountry(req.headers),currency=currencyForCountry(country);
 const rate=currency==='EUR'?await getEuroReferenceRate():null;
 return NextResponse.json({country,detection:country?'ip':'unavailable',locale:selectLocale(req.cookies.get(LOCALE_COOKIE)?.value,req.headers.get('accept-language'),country),currency,displayCurrency:currency==='EUR'&&rate?'EUR':'RON',chargeCurrency:'RON',referenceRate:rate},{headers:{'Cache-Control':'private, no-store',Vary:'Accept-Language, Cookie'}});
}
