import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {requireAdminWorkspacePermission} from '@/components/AdminWorkspacePage';
import {InternationalBookingPreview} from '@/components/InternationalTariffReview';
import {internationalReviewEnabled} from '@/lib/internationalRollout';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Previzualizare piețe internaționale',robots:{index:false,follow:false},alternates:{canonical:null}};

export default async function Page(){
 if(!internationalReviewEnabled())notFound();
 await requireAdminWorkspacePermission('super_admin');
 return <InternationalBookingPreview/>;
}
