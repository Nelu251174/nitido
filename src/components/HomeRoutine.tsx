'use client';
import {UiText} from '@/components/UiText';
import Link from 'next/link';
import {useCurrentUser} from '@/lib/useCurrentUser';
import {RecurringSection} from './RecurringSection';

export function HomeRoutine(){
 const {user,loading,error,retry}=useCurrentUser();
 if(loading)return <p role="status"><UiText text="Se încarcă…"/></p>;
 if(error)return <div role="alert"><p>{<UiText text={error}/>}</p><button type="button" className="v2-btn" onClick={retry}><UiText text="Reîncearcă"/></button></div>;
 if(!user)return <p><Link className="v2-btn v2-btn-primary" href="/login?role=client&next=%2Fclient%2Frutina"><UiText text="Intră în contul de client"/></Link></p>;
 if(user.role!=='client')return <p role="alert"><UiText text="Această pagină este disponibilă în contul de client."/></p>;
 return <RecurringSection key={user.id} defaults={{street:'',postalCode:'',city:'',floor:'',sqm:80,spaceType:'apartament'}}/>;
}
