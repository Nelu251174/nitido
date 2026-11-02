import type {Metadata} from 'next';
import {notFound,redirect} from 'next/navigation';
import {getCurrentUser} from '@/lib/auth';
import {internationalPricingEnabled} from '@/lib/internationalRollout';
import {internationalTimezone} from '@/lib/internationalScheduling';
import {InternationalBooking} from '@/components/InternationalBooking';
import research from '@/data/internationalResearchReview.json';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Curățenie în Europa',robots:{index:false,follow:false},alternates:{canonical:null}};

export default async function Page(){
 if(!internationalPricingEnabled())notFound();
 const user=await getCurrentUser();
 if(!user)redirect('/login?next=/international/booking');
 if(user.role!=='client')redirect('/firma');
 const markets=research.countries.map(country=>({code:country.code,name:country.name,timeZone:internationalTimezone(country.code),cities:country.cities.map(city=>({key:city.cityKey,name:city.name}))}));
 return <InternationalBooking markets={markets}/>;
}
