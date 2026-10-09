import type { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { hasAdminPermission, type AdminRole } from './adminRolesShared';
import { RESOLUTION_KINDS, type IncidentResolution, type ResolutionKind } from './incidentResolutionShared';
import { WorkspaceError, requireText } from './workspace';
export { INCIDENT_RESOLUTION_SCHEMA } from './operationsSchema';
export function incidentResolutions(db: Database, caseId: string): IncidentResolution[] { return db.prepare('SELECT * FROM incident_resolutions WHERE case_id=? ORDER BY created_at DESC,id DESC').all(caseId) as IncidentResolution[]; }
export function resolveIncident(db: Database, b: Record<string, unknown>, actor: {
    id: string;
    role: AdminRole;
}) {
    if (!db.inTransaction)
        throw new Error('Resolution transaction required');
    const id = requireText(b.caseId, 'Dosar', 100), note = requireText(b.note, 'Motivul rezoluției', 2000);
    if (typeof b.kind !== 'string' || !Object.hasOwn(RESOLUTION_KINDS, b.kind) || !['propose', 'complete'].includes(String(b.action)))
        throw new WorkspaceError('Rezoluție invalidă.');
    const kind = b.kind as ResolutionKind, complete = b.action === 'complete', financial = kind === 'refund' || kind === 'credit';
    const allowed = complete ? (financial ? 'finance' : 'manage') : 'operations';
    if (!hasAdminPermission(actor.role, allowed) && !(financial && hasAdminPermission(actor.role, 'finance')))
        throw new WorkspaceError('Rolul nu permite această rezoluție.', 403);
    const c = db.prepare('SELECT c.*,j.accepted_firm_id FROM visit_cases c JOIN jobs j ON j.id=c.job_id WHERE c.id=?').get(id) as {
        job_id: string;
        status: string;
        updated_at: string;
        reclean_job_id: string | null;
        accepted_firm_id: string | null;
    } | undefined;
    if (!c)
        throw new WorkspaceError('Dosar inexistent.', 404);
    if (c.updated_at !== b.revision)
        throw new WorkspaceError('Dosarul s-a schimbat. Reîncarcă.', 409);
    if (['closed', 'resolved'].includes(c.status))
        throw new WorkspaceError('Dosarul este deja soluționat.', 409);
    const review = db.prepare('SELECT outcome FROM visit_case_reviews WHERE case_id=? ORDER BY created_at DESC,id DESC LIMIT 1').get(id) as {
        outcome: string;
    } | undefined;
    if (complete && kind === 'reject' && review?.outcome !== 'not_confirmed')
        throw new WorkspaceError('Respingerea necesită o verificare cu concluzia «Problemă neconfirmată».', 409);
    if (complete && kind !== 'reject' && review?.outcome !== 'confirmed')
        throw new WorkspaceError('Confirmă problema și dovezile înainte de rezoluția finală.', 409);
    let reference: string | null = null;
    if (complete) {
        if (c.reclean_job_id && !db.prepare("SELECT 1 FROM jobs WHERE id=? AND status IN ('completed','cancelled')").get(c.reclean_job_id))
            throw new WorkspaceError('Vizita de remediere este încă activă.', 409);
        if (kind === 'remediation') {
            if (!c.reclean_job_id || !db.prepare("SELECT 1 FROM jobs WHERE id=? AND guarantee_of=? AND status='completed'").get(c.reclean_job_id, c.job_id))
                throw new WorkspaceError('Rezoluția necesită vizita de remediere finalizată în fluxul client–prestator.', 409);
            reference = c.reclean_job_id;
        }
        else if (kind === 'refund') {
            const p = db.prepare("SELECT p.id FROM payments p JOIN payment_refunds r ON r.payment_id=p.id WHERE p.job_id=? AND p.refund_status='succeeded' AND p.status='refunded' AND r.status='succeeded'").get(c.job_id) as {
                id: string;
            } | undefined;
            if (!p)
                throw new WorkspaceError('Rambursarea nu este confirmată în fluxul financiar existent.', 409);
            reference = p.id;
        }
        else if (kind === 'credit' || kind === 'provider_penalty')
            throw new WorkspaceError('Propunerea rămâne în așteptare până la configurarea și aprobarea politicii comerciale. Nu a fost aplicată o sumă.', 409);
        else if (kind === 'provider_review')
            reference = requireText(b.reference, 'Referința verificării prestatorului', 300);
        else if (kind === 'provider_suspension') {
            if (!c.accepted_firm_id)
                throw new WorkspaceError('Lucrarea nu are prestator alocat.', 409);
            const until = typeof b.reference === 'string' ? Date.parse(b.reference) : NaN;
            if (!Number.isFinite(until) || until <= Date.now())
                throw new WorkspaceError('Completează data viitoare până la care a fost aprobată suspendarea.');
            reference = new Date(until).toISOString();
            const firm = db.prepare('SELECT suspended_until FROM firms WHERE id=?').get(c.accepted_firm_id) as {
                suspended_until: string | null;
            } | undefined;
            if (!firm)
                throw new WorkspaceError('Prestator inexistent.', 404);
            if (firm.suspended_until && Date.parse(firm.suspended_until) > until)
                throw new WorkspaceError('Rezoluția nu poate scurta suspendarea existentă.', 409);
            db.prepare('UPDATE firms SET suspended_until=? WHERE id=?').run(reference, c.accepted_firm_id);
        }
    }
    const now = new Date(Math.max(Date.now(), Date.parse(c.updated_at) + 1)).toISOString(), resolutionId = randomUUID();
    db.prepare('INSERT INTO incident_resolutions VALUES(?,?,?,?,?,?,?,?)').run(resolutionId, id, kind, complete ? 'completed' : 'pending', note, reference, actor.id, now);
    db.prepare('UPDATE visit_cases SET updated_at=?,status=? WHERE id=?').run(now, complete ? (kind === 'reject' ? 'closed' : 'resolved') : c.status, id);
    return { id: resolutionId, caseId: id, kind, state: complete ? 'completed' : 'pending', revision: now, reference };
}
