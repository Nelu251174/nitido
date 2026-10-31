import {redirect} from 'next/navigation';
import {getAdminIdentity} from '@/lib/adminAuth';
import {AdminWorkspaceAuth} from '@/components/AdminWorkspaceAuth';
import {AdminWorkspaceShell} from '@/components/AdminWorkspaceShell';
import {AdminWorkspaceDashboard} from '@/components/AdminWorkspaceDashboard';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const identity=await getAdminIdentity();if(!identity)return <AdminWorkspaceAuth/>;if(identity.role==='finance'){const query=await searchParams,jobId=query.jobId??query.focusJob;redirect('/admin/financiar'+(jobId?'?tab=lucrari&jobId='+encodeURIComponent(jobId):''));}return <AdminWorkspaceShell identity={identity} title="Azi" description="Prioritățile, intervențiile și situațiile care au nevoie de tine."><AdminWorkspaceDashboard/></AdminWorkspaceShell>;}
