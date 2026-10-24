import type { MarketingCategory } from './adminMarketingShared';
export const CAMPAIGN_STATES = { draft: 'Ciornă', ready: 'Pregătită', paused: 'În pauză', archived: 'Arhivată' } as const;
export interface MarketingSettings {
  version: number; senderName: string; senderEmail: string; replyTo: string; postalAddress: string;
  dailyLimit: number; unitCostRon: number | null; monthlyBudgetRon: number | null;
}
export interface MarketingCampaign {
  id: string; version: number; name: string; subject: string; body: string; category: MarketingCategory | '';
  city: string; ctaLabel: string; ctaUrl: string; budgetRon: number | null;
  state: keyof typeof CAMPAIGN_STATES; updatedAt: string;
}
export interface MarketingAudience {
  selected: number; eligible: number; excluded: number;
  reasons: { suppressed: number; noEmail: number; noConsent: number; notReviewed: number; duplicate: number };
  estimatedCostRon: number | null; blockers: string[]; html: string;
}
export interface MarketingSimulation {
  id: string; campaignId: string; campaignName: string; eligible: number; excluded: number;
  estimatedCostRon: number | null; createdAt: string; realEmailsSent: 0;
}
export interface MarketingCollectionRun {
  id: string; source: string; city: string; category: string; requested: number; selected: number;
  created: number; duplicates: number; excluded: number; createdAt: string;
}
export interface MarketingWorkspace {
  settings: MarketingSettings; campaigns: MarketingCampaign[]; simulations: MarketingSimulation[]; collections: MarketingCollectionRun[];
  totals: { contacts: number; reviewed: number; suppressed: number; eligible: number; campaigns: number; simulations: number; simulatedRecipients: number; realEmailsSent: number };
  deliveryEnabled: boolean;
}
