import type {Database} from 'better-sqlite3';
import {initializeDatabase} from '../db';
import {ensureInternationalCrewCapacitySchema} from '../internationalCrewCapacity';
import {parseInternationalTariff,saveInternationalTariffDraft,transitionInternationalTariff} from '../internationalTariffs';
import {issueInternationalBookingQuote} from '../internationalBooking';
export const internationalFixtureNow=new Date('2026-11-02T08:00:00.000Z');
export const internationalFixtureContext={countryCode:'ES',city:'Madrid',spaceType:'apartament',service:'general',sqm:70};
/** Isolated synthetic evidence; never a deployable market tariff or a real booking. */
export function internationalJobFixture(db:Database){
 db.pragma('foreign_keys=ON');initializeDatabase(db);ensureInternationalCrewCapacitySchema(db);
 db.exec(`INSERT INTO users(id,role,name,stripe_customer_id,stripe_payment_method_id) VALUES
 ('synthetic-owner','client','Synthetic owner','cus_fixture','pm_fixture'),
 ('synthetic-other','client','Other synthetic owner','cus_other','pm_other'),
 ('synthetic-firm-owner','firma','Synthetic provider',NULL,NULL),
 ('synthetic-worker-1','client','Synthetic worker one',NULL,NULL),
 ('synthetic-worker-2','client','Synthetic worker two',NULL,NULL);
 INSERT INTO firms(id,user_id,coverage_city,verified,stripe_account_id,stripe_account_status,stripe_transfers_capability,stripe_identity_country,stripe_default_currency)
 VALUES('synthetic-firm','synthetic-firm-owner','Madrid',1,'acct_fixture','ready','active','ES','EUR');
 INSERT INTO client_saved_cards(id,user_id,customer_id,payment_method_id,slot) VALUES('synthetic-card','synthetic-owner','cus_fixture','pm_fixture',1),('other-card','synthetic-other','cus_other','pm_other',1);
 INSERT INTO workspace_teams(id,firm_id,name,minimum_duration_minutes,travel_minutes) VALUES('synthetic-team','synthetic-firm','Synthetic team',180,30);
 INSERT INTO workspace_members(id,kind,resource_id,user_id,role,active,created_at) VALUES
 ('synthetic-member-1','team','synthetic-team','synthetic-worker-1','worker',1,'2026-11-02T08:00:00Z'),
 ('synthetic-member-2','team','synthetic-team','synthetic-worker-2','worker',1,'2026-11-02T08:00:00Z');
 INSERT INTO international_team_capacity(team_id,firm_id,verified_workers,verified_by,verified_at,valid_until,verification_reference) VALUES('synthetic-team','synthetic-firm',2,'bootstrap_admin','2026-11-02T08:00:00Z','2026-12-02T08:00:00Z','synthetic-crew-evidence');`);
 const definition=parseInternationalTariff({countryCode:'ES',city:'Madrid',spaceType:'apartament',service:'general',currency:'EUR',rateUnit:'worker_hour',rateMinor:4100,workers:2,minimumMinutes:180,supplierMinimumMinutes:180,minimumNetMinor:0,vatBps:2100,materials:{status:'included',feeMinor:0},travel:{status:'separate',feeMinor:1000},maxSqm:100,durationMinutes:180,validFrom:'2026-11-01',validUntil:'2026-12-31',sources:[
 {providerId:'synthetic-a',provider:'Synthetic supplier A',url:'https://clean-a.example.test/prices',readAt:'2026-11-02',quote:'Synthetic isolated quote; no real market evidence.',localCoverage:true,conditionsConfirmed:true,independentProviderConfirmed:true},
 {providerId:'synthetic-b',provider:'Synthetic supplier B',url:'https://clean-b.example.test/prices',readAt:'2026-11-02',quote:'Synthetic isolated quote; no real market evidence.',localCoverage:true,conditionsConfirmed:true,independentProviderConfirmed:true}],verification:{pricing:true,vat:true,minimum:true,crew:true,materials:true,travel:true,coverage:true}});
 const draft=saveInternationalTariffDraft(db,undefined,0,definition,'synthetic-admin',internationalFixtureNow);
 const approved=transitionInternationalTariff(db,draft.id,draft.revision,'approved','synthetic-admin','Synthetic isolated review',internationalFixtureNow);
 transitionInternationalTariff(db,approved.id,approved.revision,'active','synthetic-admin','Synthetic isolated activation',internationalFixtureNow);
 const quote=issueInternationalBookingQuote(db,'synthetic-owner',internationalFixtureContext,internationalFixtureNow);
 const body={quoteId:quote.id,context:internationalFixtureContext,street:'Synthetic street 123',postalCode:'28001',floor:'2',scheduledLocal:'2026-11-03T10:00',cardId:'synthetic-card'};
 return {quote,body};
}
