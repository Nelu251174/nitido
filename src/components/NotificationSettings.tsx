'use client';
import {CommunicationPreferences} from './CommunicationPreferences';
import {useEffect} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useCurrentUser} from '@/lib/useCurrentUser';
import {authSwitchHref} from '@/lib/authRedirect';
import {NativePushControls} from './NativePushControls';
import {WorkspaceNav} from './WorkspaceNav';
import {Logo} from './ui';

export function NotificationSettings({role}:{role:'client'|'firma'}) {
  const {user,loading}=useCurrentUser();
  const router=useRouter();
  useEffect(()=>{
    if(!loading&&user?.role!==role)router.replace(authSwitchHref('login',`/${role}/setari`,role));
  },[loading,user,role,router]);
  if(loading||user?.role!==role)return <p className="p-6" role="status">Se încarcă setările…</p>;
  return <div className={`operations-layout role-${role}`}>
    <aside className="operations-sidebar"><Logo href={`/${role}`}/><WorkspaceNav role={role}/></aside>
    <main className="operations-main"><div className="notification-settings">
      <h1>Setări</h1>
      <CommunicationPreferences/>
      <section className="v2-card">
        <h2>Notificări și sunet</h2>
        <p>Primește notificări despre mesaje și activitatea lucrărilor.</p>
        <NativePushControls role={role}/>
        <p>Pentru sunet, vibrații și afișarea pe ecranul blocat, deschide Setări pe telefon, alege NITIDO, apoi Notificări. Se respectă volumul și modul silențios al telefonului.</p>
        <p>În browser, permisiunile se gestionează din setările site-ului. Pe calculator, poți afișa comenzile de sunet timp de 15 secunde.</p>
        <button className="v2-btn v2-btn-secondary desktop-alert-settings" onClick={()=>window.dispatchEvent(new Event("nitido:alert-controls"))}>Afișează comenzile de sunet</button>
      </section>
      <Link className="v2-btn v2-btn-secondary mt-6" href={`/${role}`}>Înapoi în cont</Link>
    </div></main>
  </div>;
}
