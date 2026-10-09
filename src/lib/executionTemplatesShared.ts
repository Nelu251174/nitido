export type ExecutionItem={key:string;label:string};
export const EXECUTION_SCOPES=[['standard','Rezervări Standard'],['express','Rezervări Express'],['maintenance','Evaluare: întreținere'],['general','Evaluare: curățenie generală'],['renovation','Evaluare: după renovare'],['moving','Evaluare: mutare'],['office','Evaluare: birouri'],['host','Evaluare: proprietăți turistice']] as const;
export type PhotoRules={arrivalMin:number;completionMin:number};
export type ExecutionTemplate={photoRules:PhotoRules;scope:string;revision:number;items:ExecutionItem[];reason:string|null;actor:string|null;createdAt:string|null};
