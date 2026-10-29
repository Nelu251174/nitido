import {describe,it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {initializeDatabase} from './db';
import {createVerifiedReview,getPublicTrustSnapshot} from './reviews';
import {getFirmQuality} from './qualityIndex';
import {listOffersForJob} from './offers';
import {verifiedFirmRating} from './verifiedFirmRating';
function fixture(){
 const db=new Database(':memory:');initializeDatabase(db);
 db.exec(`INSERT INTO users(id,role,name) VALUES('client','client','Client'),('other','client','Other'),('fu','firma','Firm');
 INSERT INTO firms(id,user_id,coverage_city,verified) VALUES('firm','fu','Constanța',1);
 INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status,accepted_firm_id,mode) VALUES('done','client','Fixture','Constanța',50,'apartament','asap',100,180,'completed','firm','standard'),('new','client','Fixture','Constanța',50,'apartament','asap',100,180,'waiting',NULL,'standard');
 INSERT INTO offers(id,job_id,firm_id,status) VALUES('offer','new','firm','pending');
 INSERT INTO payments(id,job_id,amount_gross,commission_amount,amount_net,status) VALUES('payment','done',100,18,82,'captured');`);
 for(const type of ['ARRIVAL','COMPLETION'])db.prepare("INSERT INTO job_photos(id,job_id,owner_user_id,uploaded_by_firm_id,proof_type,filename,mime_type,file_size,status,validated_at) VALUES(?,'done','fu','firm',?,'fixture.png','image/png',1,'VALID',datetime('now'))").run(type,type);
 expect(createVerifiedReview(db,{jobId:'done',clientId:'client',rating:1}).ok).toBe(true);return db;
}
function compare(db:ReturnType<typeof fixture>,expected:number){
 const publicFirm=getPublicTrustSnapshot(db,'firm').firms[0],quality=getFirmQuality(db,'firm'),offer=listOffersForJob(db,'new')[0];
 expect(publicFirm.review_count).toBe(expected);expect(quality.ratingCount).toBe(expected);expect(offer.ratingCount).toBe(expected);
 expect(offer.ratingAvg).toBe(expected?1:null);expect(quality.avgStars).toBe(expected?1:null);expect(quality.rating).toBe(expected?12:0);
 expect(verifiedFirmRating(db,'firm')).toEqual({average:expected?1:null,count:expected});
}
describe('one verified-review policy across public, offers and quality',()=>{
 it('preserves a genuine negative review in every view',()=>{const db=fixture();try{compare(db,1);}finally{db.close();}});
 it.each([
  "UPDATE ratings SET moderation_status='hidden'",
  "UPDATE ratings SET status='removed'",
  "UPDATE jobs SET status='arrived' WHERE id='done'",
  "UPDATE payments SET status='authorized'",
  "UPDATE job_photos SET status='REJECTED' WHERE proof_type='COMPLETION'",
  "UPDATE job_photos SET validated_at=NULL WHERE proof_type='ARRIVAL'",
  "UPDATE ratings SET client_id='other'",
  "UPDATE jobs SET accepted_firm_id=NULL WHERE id='done'",
  "INSERT INTO job_photo_rules(job_id,arrival_min,completion_min) VALUES('done',2,2)"
 ])('excludes an ineligible or moderated review consistently: %s',sql=>{const db=fixture();try{db.exec(sql);compare(db,0);}finally{db.close();}});
 it('does not invent stars for an unknown firm',()=>{const db=fixture();try{expect(verifiedFirmRating(db,'missing')).toEqual({average:null,count:0});}finally{db.close();}});
});
