import {describe,it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {prepareMarketingLaunchCampaigns} from './adminMarketingCampaignPreparation';
import {getMarketingWorkspace,saveMarketingCampaign} from './adminMarketingWorkspace';
describe('draft-only county campaign preparation',()=>{it('prepares three audiences per county without replacing edits or creating delivery jobs',()=>{
 const db=new Database(':memory:');db.exec('CREATE TABLE admin_audit_log(id TEXT PRIMARY KEY,action TEXT,target_id TEXT,details TEXT)');
 try{expect(prepareMarketingLaunchCampaigns(db,'owner')).toEqual({created:12,existing:0});let ws=getMarketingWorkspace(db);expect(ws.campaigns.every(c=>c.state==='draft'&&c.county&&c.recipientLimit===50)).toBe(true);
 const c=ws.campaigns[0];saveMarketingCampaign(db,{...c,subject:'Owner edit'},'owner');expect(prepareMarketingLaunchCampaigns(db,'owner')).toEqual({created:0,existing:12});ws=getMarketingWorkspace(db);expect(ws.campaigns.find(x=>x.id===c.id)?.subject).toBe('Owner edit');expect(ws.totals.realEmailsSent).toBe(0);expect(db.prepare("SELECT 1 FROM sqlite_master WHERE name='marketing_outbox'").get()).toBeUndefined();
 }finally{db.close();}
});});
