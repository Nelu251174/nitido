import type {SpaceType} from "./types";
export const JOB_TYPE_LABELS:Record<SpaceType,string>={apartament:"Curățenie apartament",casa:"Curățenie casă",birou:"Curățenie birou / office",altul:"Curățenie – alt tip de spațiu"};
export function jobTypeLabel(value:string){return JOB_TYPE_LABELS[value as SpaceType]??"Serviciu de curățenie"}
