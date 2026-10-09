export const ORGANIZATION_MODULES=[
 {key:'business',label:'Birouri și firme',description:'Portofoliu de locații Business, bugete și solicitări de curățenie.'},
 {key:'host',label:'Curățenie între rezervări',description:'Perioade ocupate, pregătirea proprietății și propuneri de curățenie.'},
 {key:'ical',label:'Sincronizare iCal',description:'Actualizarea automată a calendarelor pentru curățenie între rezervări.'},
] as const;
export type OrganizationModule=typeof ORGANIZATION_MODULES[number]['key'];
export type OrganizationModules={business:boolean;host:boolean;ical:boolean;revision:number};
