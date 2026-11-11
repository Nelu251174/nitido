/** Public research evidence only. These types never define a chargeable tariff. */
export type ResearchValue = string | number | boolean | null | ResearchValue[] | { [key: string]: ResearchValue };
export type ResearchCategory = 'apartament' | 'casa' | 'birou';
export type ResearchReviewStatus = 'incomplete' | 'needs_clarification';

export interface InternationalResearchSource {
  id: string;
  provider: string;
  /** Same provider can use several domains; this is not a legal independence certificate. */
  providerKey: string;
  countryCode: string;
  cityKeys: string[];
  url: string;
  readAt: string;
  read: boolean;
  classification: string;
  ownPublishedPrice: boolean;
  localCoverage: ResearchValue;
  quotes: string[];
  prices: ResearchValue[];
  currency: string | null;
  vat: ResearchValue;
  minimum: ResearchValue;
  materials: ResearchValue;
  travel: ResearchValue;
  crew: ResearchValue;
  missingConditions: string[];
  researchNotes: string[];
  correction: ResearchValue;
  wholePropertyEvidenceEligible: boolean;
  commercialReady: boolean;
  conditionsComplete: boolean;
  legalIndependence: { status: string; distinctBrandIsNotProofOfIndependence: boolean };
  provenance: { snapshot: string; consultedAt: string; sourceURL: string; baselineAlsoAvailable: boolean };
}

export interface InternationalResearchCity {
  id: string;
  cityKey: string;
  name: string;
  reviewStatus: ResearchReviewStatus;
  commercialReady: boolean;
  gaps: string[];
  serviceCategories: ResearchCategory[];
  categoryReviews: Array<{ category: ResearchCategory; reviewStatus: string; commercialReady: boolean; requiredWorkers: number[]; minimumRequestedOnsiteHours: number }>;
  sources: InternationalResearchSource[];
  /** Counts own public evidence, never approved prices or comparable independent firms. */
  publishedCount: number;
  ownPriceSourceCount: number;
  completeCount: number;
}

export interface InternationalResearchManifest {
  schemaVersion: number;
  updatedAt: string;
  researchOnly: boolean;
  scope: { countries: number; cities: number; romaniaIncluded: boolean; commercialPricesGenerated: boolean; baselineSourceAssignments: number; currentSourceRecords: number; note: string };
  countries: Array<{ code: string; name: string; cities: InternationalResearchCity[] }>;
  totals: Record<string, number>;
  countsDefinition: string;
}
