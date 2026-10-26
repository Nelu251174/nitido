export const MARKETING_CATEGORIES = {
  business: 'Clienți business',
  cleaning: 'Firme de curățenie',
  individual: 'Persoane fizice',
} as const;
export type MarketingCategory = keyof typeof MARKETING_CATEGORIES;
export const MARKETING_STATUSES = { new: 'Nou', reviewed: 'Verificat', do_not_contact: 'Nu contacta' } as const;
export type MarketingStatus = keyof typeof MARKETING_STATUSES;
export const MARKETING_CONSENTS = { not_recorded: 'Acord neînregistrat', granted: 'Acord înregistrat', withdrawn: 'Acord retras' } as const;
export type MarketingConsent = keyof typeof MARKETING_CONSENTS;
export interface MarketingInput {
  name: string;
  category: MarketingCategory;
  email: string;
  phone: string;
  city: string;
  county?: string;
  cui: string;
  website: string;
  source: string;
  consent: MarketingConsent;
  consentEvidence: string;
  notes: string;
}
export interface MarketingContact extends MarketingInput {
  id: string;
  status: MarketingStatus;
  version: number;
  createdAt: string;
  regions?: {county:string;city:string}[];
  emailVerification?: import('./adminMarketingRegions').MarketingEmailVerification;
}
export interface MarketingList {
  contacts: MarketingContact[];
  total: number;
  page: number;
  counts: Record<MarketingCategory, number>;
}
