import type {SpaceType} from "@/lib/pricing";

export const JOB_TYPE_LABELS:Record<SpaceType,string>={
  apartament:"Curățenie apartament",
  casa:"Curățenie casă",
  birou:"Curățenie birou / office",
  altul:"Curățenie – alt tip de spațiu",
};
export const PROPERTY_TYPE_LABELS:Record<SpaceType,string>={apartament:"Apartament",casa:"Casă",birou:"Birou",altul:"Altul"};

export function jobTypeLabel(value:string):string {
  return JOB_TYPE_LABELS[value as SpaceType]??"Serviciu de curățenie";
}
