import {UiText} from '@/components/UiText';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {getCurrentUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {getOwnReviewJobs} from '@/lib/reviews';
import {ReviewWorkspace} from '@/components/ReviewWorkspace';
export const dynamic='force-dynamic';
export default async function Page(){
 const user=await getCurrentUser(undefined,{readOnly:true});
 if(!user)redirect('/login?role=client&next=%2Fclient%2Fevaluari-lucrari');
 return <main id="main-content" className="mx-auto max-w-2xl px-5 py-10">{user.role==='client'?<ReviewWorkspace jobs={getOwnReviewJobs(db,user.id)}/>:<><h1 className="text-2xl font-bold"><UiText text={"Evaluările sunt disponibile clienților"}/></h1><p className="my-5"><UiText text={"Poți evalua numai serviciile primite ca client, după o lucrare finalizată. Firmele nu își pot evalua propriile servicii."}/></p><Link href={user.role==='firma'?'/firma':'/'}><UiText text={"Înapoi în cont"}/></Link></>}</main>;
}
