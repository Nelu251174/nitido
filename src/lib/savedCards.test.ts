import {afterEach,beforeEach,describe,expect,it} from "vitest";
import Database from "better-sqlite3";
import {activeCards,authorizationCard,initializeSavedCards,removeSavedCard,saveConfirmedCard,saveJobCard,setDefaultCard} from "./savedCards";

let db:Database.Database;
const details=(last4="4242",fingerprint=last4)=>({brand:"visa",last4,exp_month:12,exp_year:2034,fingerprint});
const add=(n:number,user="owner")=>saveConfirmedCard(db,user,`cus_${user}`,`pm_${n}`,`cs_${user}_${n}`,details(String(4000+n)));
const defaultMethod=()=> (db.prepare("SELECT stripe_payment_method_id FROM users WHERE id='owner'").get() as {stripe_payment_method_id:string|null}).stripe_payment_method_id;
beforeEach(()=>{
 db=new Database(":memory:");db.pragma("foreign_keys=ON");
 db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,stripe_customer_id TEXT,stripe_payment_method_id TEXT);
 CREATE TABLE jobs(id TEXT PRIMARY KEY,client_id TEXT REFERENCES users(id),status TEXT);
 CREATE TABLE payment_authorization_attempts(job_id TEXT PRIMARY KEY,request_json TEXT);
 CREATE TABLE payments(id TEXT PRIMARY KEY,job_id TEXT,amount INTEGER,status TEXT);
 INSERT INTO users VALUES('owner','cus_owner','pm_legacy'),('other','cus_other',NULL);
 INSERT INTO jobs VALUES('existing','owner','waiting');
 INSERT INTO payments VALUES('paid','completed',55000,'captured');
 CREATE TRIGGER immutable_payment BEFORE UPDATE ON payments BEGIN SELECT RAISE(ABORT,'Existing payment changed'); END;`);
 initializeSavedCards(db);
});
afterEach(()=>db.close());

describe("three-card account",()=>{
 it("migrates the existing default once and freezes published jobs",()=>{
  const before=activeCards(db,"owner");initializeSavedCards(db);
  expect(before).toHaveLength(1);expect(activeCards(db,"owner")).toEqual(before);
  expect(authorizationCard(db,"existing").paymentMethodId).toBe("pm_legacy");
  expect(db.pragma("foreign_key_check")).toEqual([]);
 });
 it("keeps the default when adding second and third cards, rejects a fourth atomically",()=>{
  add(1);add(2);expect(activeCards(db,"owner")).toHaveLength(3);
  expect(()=>add(3)).toThrow("3 carduri");expect(defaultMethod()).toBe("pm_legacy");
  expect(db.prepare("SELECT count(*) n FROM client_card_setup_results").get()).toEqual({n:2});
 });
 it("enforces slot uniqueness and the three-card limit independently of JavaScript",()=>{
  expect(()=>db.prepare("INSERT INTO client_saved_cards(id,user_id,customer_id,payment_method_id,slot) VALUES('bad','owner','cus_owner','pm_bad',4)").run()).toThrow();
  expect(()=>db.prepare("INSERT INTO client_saved_cards(id,user_id,customer_id,payment_method_id,slot) VALUES('dup','owner','cus_owner','pm_dup',1)").run()).toThrow();
 });
 it("admits only one of two simultaneous callbacks into the last slot",async()=>{
  add(1);
  const results=await Promise.allSettled([Promise.resolve().then(()=>add(2)),Promise.resolve().then(()=>add(3))]);
  expect(results.map(r=>r.status).sort()).toEqual(["fulfilled","rejected"]);
  expect(activeCards(db,"owner")).toHaveLength(3);
 });
 it("deduplicates replay and the same physical card without consuming another slot",()=>{
  const id=add(1);expect(add(1)).toBe(id);
  expect(saveConfirmedCard(db,"owner","cus_owner","pm_copy","cs_copy",details("4001"))).toBe(id);
  expect(activeCards(db,"owner")).toHaveLength(2);
 });
 it("does not resurrect a removed card from an old Checkout callback",()=>{
  const id=add(1);removeSavedCard(db,"owner",id);
  expect(()=>add(1)).toThrow("eliminat");
  expect(activeCards(db,"owner")).toHaveLength(1);
 });
 it("can reuse a freed slot and selects a remaining default on removal",()=>{
  const one=add(1);add(2);setDefaultCard(db,"owner",one);removeSavedCard(db,"owner",one);
  add(3);expect(activeCards(db,"owner")).toHaveLength(3);expect(defaultMethod()).toBe("pm_legacy");
 });
 it("prevents selecting or removing another client's card",()=>{
  const other=add(9,"other");
  expect(()=>setDefaultCard(db,"owner",other)).toThrow("contul tău");
  expect(()=>removeSavedCard(db,"owner",other)).toThrow("contul tău");
  db.prepare("INSERT INTO jobs VALUES('new','owner','waiting')").run();
  expect(()=>saveJobCard(db,"owner","new",other)).toThrow("contul tău");
 });
 it("locks a waiting job to its chosen card despite a later default change",()=>{
  const one=add(1),two=add(2);
  db.prepare("INSERT INTO jobs VALUES('new','owner','waiting')").run();
  saveJobCard(db,"owner","new",one);setDefaultCard(db,"owner",two);
  expect(authorizationCard(db,"new")).toEqual({customerId:"cus_owner",paymentMethodId:"pm_1"});
  expect(()=>removeSavedCard(db,"owner",one)).toThrow("așteptare");
  expect(db.prepare("SELECT amount,status FROM payments").get()).toEqual({amount:55000,status:"captured"});
 });
 it("keeps authorizations usable after a card leaves the active account list",()=>{
  const one=add(1);db.prepare("INSERT INTO jobs VALUES('new','owner','waiting')").run();saveJobCard(db,"owner","new",one);
  db.prepare("UPDATE jobs SET status='accepted' WHERE id='new'").run();removeSavedCard(db,"owner",one);
  expect(authorizationCard(db,"new").paymentMethodId).toBe("pm_1");
 });
 it("uses the original uncertain Stripe attempt for legacy jobs",()=>{
  db.prepare("INSERT INTO jobs VALUES('retry','owner','waiting')").run();
  db.prepare("INSERT INTO payment_authorization_attempts VALUES('retry',?)").run(JSON.stringify({customer:"cus_owner",payment_method:"pm_original"}));
  setDefaultCard(db,"owner",add(1));
  expect(authorizationCard(db,"retry").paymentMethodId).toBe("pm_original");
 });
 it("sets the first card as default for an empty account",()=>{
  add(9,"other");expect(db.prepare("SELECT stripe_payment_method_id FROM users WHERE id='other'").get()).toEqual({stripe_payment_method_id:"pm_9"});
 });
});
