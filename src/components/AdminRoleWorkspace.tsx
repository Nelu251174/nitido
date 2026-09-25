'use client';
import { AdminInternalJobs } from './AdminInternalJobs';
import { useState } from 'react';
import { ADMIN_ROLES, hasAdminPermission, type AdminIdentity } from '@/lib/adminRolesShared';
import { AdminAssessments } from './AdminAssessments';
import { AdminIncidentReviews } from './AdminIncidentReviews';
import { AdminOperationalReport } from './AdminOperationalReport';
import { AdminExecutionTemplates } from './AdminExecutionTemplates';
import { AdminServiceCatalog } from './AdminServiceCatalog';
import { AdminPricing } from './AdminPricing';
import { AdminMarginPolicy } from './AdminMarginPolicy';
import { AdminJobCosts } from './AdminJobCosts';
export function AdminRoleWorkspace({ identity }: {
    identity: AdminIdentity;
}) {
    const [jobId, setJobId] = useState(''), [message, setMessage] = useState('');
    const can = (p: Parameters<typeof hasAdminPermission>[1]) => hasAdminPermission(identity.role, p);
    return <main className="max-w-6xl mx-auto p-5 space-y-6" style={{ background: '#f7f3ec', minHeight: '100vh' }}><h1 className="workspace-title">{ADMIN_ROLES[identity.role]}</h1><p>{identity.email}</p><button className="v2-btn v2-btn-secondary" onClick={() => void fetch('/api/admin/auth/logout', { method: 'POST' }).then(() => location.reload())}>Închide sesiunea</button>
 <AdminInternalJobs />
 {can('operations') && <><AdminAssessments canPrice={can('manage')}/></>}
 <AdminIncidentReviews canManage={can('manage')} canReview={can('operations')} canFinance={can('finance')}/>{can('reports') && <AdminOperationalReport />}{can('manage') && <><AdminServiceCatalog /><AdminExecutionTemplates /><AdminPricing /><AdminMarginPolicy /></>}
 {can('finance') && <section className="design-panel space-y-3"><h2 className="font-bold text-xl">Verificare financiară pe lucrare</h2><p>Folosește identificatorul ofertei asistate pentru costuri. Costurile documentate și rambursarea integrală sunt operațiuni separate; o cerere de rambursare nu confirmă plata către client.</p><label className="block">Identificator ofertă asistată<input className="w-full rounded-xl border p-3" value={jobId} maxLength={100} onChange={e => setJobId(e.target.value)}/></label>{jobId && <AdminJobCosts offerId={jobId}/>}<button className="v2-btn v2-btn-secondary" disabled={!jobId} onClick={() => setMessage('Rambursările se verifică și se execută din rezoluția incidentului asociat lucrării.')}>Instrucțiuni rambursare</button>{message && <p role="status">{message}</p>}</section>}
 </main>;
}
