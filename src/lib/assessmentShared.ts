export const ASSESSMENT_STATUS={submitted:'Trimisă spre evaluare',needs_details:'Sunt necesare completări',reviewed:'Evaluare primită',declined:'Cerere nepreluată',cancelled:'Anulată'} as const;
export type AssessmentStatus=keyof typeof ASSESSMENT_STATUS;
export interface AssessmentInput {category:string;city:string;sqm:number;rooms:number;bathrooms:number;difficulty:'light'|'normal'|'heavy';notes:string;appliances:number;windowsSqm:number;linenSets:number;extraHours:number}
export interface AssessmentMessage{id:number;author:'client'|'admin';body:string;createdAt:string}
export interface Assessment extends AssessmentInput{id:string;status:AssessmentStatus;version:number;createdAt:string;clientName?:string;messages:AssessmentMessage[]}
