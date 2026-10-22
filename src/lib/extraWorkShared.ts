export type ExtraWorkTerms={category:string;description:string;proposedBani:number;sqm:number;rooms:number;bathrooms:number;difficulty:'light'|'normal'|'heavy';contextHash:string};
export type ExtraWorkView={id:string;revision:number;terms:Omit<ExtraWorkTerms,'contextHash'>;status:string;createdAt:string;expiresAt:string;assessmentId:string|null};
export type ExtraWorkData={role:'client'|'firma';canPropose:boolean;proposals:ExtraWorkView[]};
