import type {Database} from 'better-sqlite3';
import editorial from '../../docs/marketing/campaign-drafts-20261025.json';
import {marketingRegion} from './adminMarketingRegions';
import {MARKETING_CATEGORIES,type MarketingCategory} from './adminMarketingShared';
import {initializeMarketingWorkspace,saveMarketingCampaign} from './adminMarketingWorkspace';
export const MARKETING_PREPARATION_SCHEMA='CREATE TABLE IF NOT EXISTS marketing_campaign_preparations(preparation_key TEXT PRIMARY KEY,campaign_id TEXT NOT NULL UNIQUE REFERENCES marketing_campaigns(id));';
export function prepareMarketingLaunchCampaigns(db:Database,actor:string){
 initializeMarketingWorkspace(db);db.exec(MARKETING_PREPARATION_SCHEMA);
 const codes=db.prepare("SELECT 1 FROM sqlite_master WHERE name='marketing_county_jobs'").get()?(db.prepare('SELECT county_code FROM marketing_county_jobs ORDER BY position').all() as {county_code:string}[]).map(j=>j.county_code):['CT','B'];
 return db.transaction(()=>{
  let created=0,existing=0;
  for(const code of codes){const region=marketingRegion(code);if(!region)continue;for(const template of editorial.templates){for(const variant of ['A','B'] as const){
   const key='launch-v1:'+code+':'+template.category+':'+variant;
   if(db.prepare('SELECT 1 FROM marketing_campaign_preparations WHERE preparation_key=?').get(key)){existing++;continue;}
   const campaign=saveMarketingCampaign(db,{name:`${region.name} · ${MARKETING_CATEGORIES[template.category as MarketingCategory]} · ${variant}`,subject:variant==='A'?template.subjectA:template.subjectB,variant,body:template.body,category:template.category,county:code,city:'',recipientLimit:50,ctaLabel:template.ctaLabel,ctaUrl:template.ctaUrl,budgetRon:null},actor);
   db.prepare('INSERT INTO marketing_campaign_preparations VALUES(?,?)').run(key,campaign.id);created++;
  }}}return {created,existing};
 }).immediate();
}
