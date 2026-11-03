import type {Metadata} from 'next';
import {notFound,redirect} from 'next/navigation';
import {headers} from 'next/headers';
import {getCurrentUser} from '@/lib/auth';
import {internationalPricingEnabled} from '@/lib/internationalRollout';
import {internationalTimezone} from '@/lib/internationalScheduling';
import {InternationalBooking} from '@/components/InternationalBooking';
import research from '@/data/internationalResearchReview.json';
import {internationalInitialCountry,internationalBookingHref} from '@/lib/bookingEntry';
import {visitorCountry} from '@/lib/visitorCountry';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Curățenie în Europa',robots:{index:false,follow:false},alternates:{canonical:null}};

export default async function Page({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}={}){
 if(!internationalPricingEnabled())notFound();
 const query=await searchParams??{};
 if(typeof query.countryCode==='string'&&query.countryCode.trim().toUpperCase()==='RO')redirect('/rezervare?countryCode=RO');
 const detectedCountry=visitorCountry(await headers());
 const initialCountryCode=internationalInitialCountry(query.countryCode,detectedCountry);
 const user=await getCurrentUser();
 if(!user)redirect('/login?'+new URLSearchParams({next:internationalBookingHref(initialCountryCode)}));
 if(user.role!=='client')redirect('/firma');
 const markets=research.countries.map(country=>({code:country.code,name:country.name,timeZone:internationalTimezone(country.code),cities:country.cities.map(city=>({key:city.cityKey,name:city.name}))}));
 return <InternationalBooking markets={markets} initialCountryCode={initialCountryCode} initialVisitorCountry={detectedCountry}/>;
}
