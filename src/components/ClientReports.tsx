'use client';
import {UiText} from '@/components/UiText';
import Link from 'next/link';
import {useCurrentUser} from '@/lib/useCurrentUser';
import {Logo} from './ui';
import {WorkspaceNav} from './WorkspaceNav';
import {BusinessExecutionReport} from './BusinessExecutionReport';
export function ClientReports(){
 const {user,loading}=useCurrentUser();
 if(loading)return <main className="p-8" role="status"><UiText text={"Se încarcă…"}/></main>;
 if(!user||user.role!=='client')return <main className="max-w-xl p-8 mx-auto"><Logo/><h1 className="workspace-title"><UiText text={"Rapoarte istorice"}/></h1><p className="my-4"><UiText text={"Intră în contul client titular al lucrărilor."}/></p><Link className="v2-btn v2-btn-primary" href="/login?role=client&next=%2Fclient%2Frapoarte"><UiText text={"Autentificare client"}/></Link></main>;
 return <div className="operations-layout approved-operations role-client"><aside className="operations-sidebar"><Logo href="/client"/><WorkspaceNav role="client"/></aside><main className="operations-main"><header className="section-heading"><h1 className="workspace-title"><UiText text={"Rapoarte și arhivă"}/></h1><Link href="/client/organizatii" className="v2-btn v2-btn-secondary"><UiText text={"Organizații"}/></Link></header><BusinessExecutionReport/></main></div>;
}
