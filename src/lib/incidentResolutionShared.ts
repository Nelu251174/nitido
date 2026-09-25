export const RESOLUTION_KINDS = { reject: 'Respingere motivată', remediation: 'Revenire pentru remediere', refund: 'Rambursare integrală', credit: 'Credit pentru o lucrare viitoare', provider_review: 'Reevaluarea prestatorului', provider_penalty: 'Penalizare propusă', provider_suspension: 'Suspendarea prestatorului' } as const;
export type ResolutionKind = keyof typeof RESOLUTION_KINDS;
export type IncidentResolution = {
    id: string;
    case_id: string;
    kind: ResolutionKind;
    state: 'pending' | 'completed';
    note: string;
    reference: string | null;
    actor_id: string;
    created_at: string;
};
