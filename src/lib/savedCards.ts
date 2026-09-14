import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";

export const MAX_CLIENT_CARDS = 3;
export class CardSetupError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

// Three numbered slots enforce the limit in SQLite, including concurrent callbacks.
// Retired references stay available to historical payments; no PAN or CVC is stored.
export const SAVED_CARDS_SCHEMA = `
CREATE TABLE IF NOT EXISTS client_saved_cards (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 customer_id TEXT NOT NULL, payment_method_id TEXT NOT NULL,
 slot INTEGER CHECK(slot IS NULL OR slot BETWEEN 1 AND 3),
 brand TEXT, last4 TEXT, exp_month INTEGER, exp_year INTEGER, fingerprint TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(user_id, slot), UNIQUE(customer_id, payment_method_id)
);
CREATE TABLE IF NOT EXISTS client_card_setup_results (
 session_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 card_id TEXT NOT NULL REFERENCES client_saved_cards(id)
);
CREATE TABLE IF NOT EXISTS client_job_cards (
 job_id TEXT PRIMARY KEY REFERENCES jobs(id), user_id TEXT NOT NULL REFERENCES users(id),
 customer_id TEXT NOT NULL, payment_method_id TEXT NOT NULL,
 card_id TEXT REFERENCES client_saved_cards(id)
);`;

export type SavedCard = { id: string; user_id: string; customer_id: string; payment_method_id: string;
  slot: number | null; brand: string | null; last4: string | null; exp_month: number | null;
  exp_year: number | null; fingerprint: string | null };
export type CardDetails = { brand: string; last4: string; exp_month: number; exp_year: number; fingerprint?: string | null };

/** Additive, repeatable migration: preserve the current card and published jobs. */
export function initializeSavedCards(db: Database) {
  db.exec(SAVED_CARDS_SCHEMA);
  db.transaction(() => {
    const users = db.prepare("SELECT id,stripe_customer_id,stripe_payment_method_id FROM users WHERE stripe_customer_id IS NOT NULL AND stripe_payment_method_id IS NOT NULL").all() as {id:string;stripe_customer_id:string;stripe_payment_method_id:string}[];
    for (const user of users) {
      const present = db.prepare("SELECT id FROM client_saved_cards WHERE user_id=? AND customer_id=? AND payment_method_id=?").get(user.id,user.stripe_customer_id,user.stripe_payment_method_id);
      if (!present) insertCard(db,user.id,user.stripe_customer_id,user.stripe_payment_method_id);
    }
    db.exec(`INSERT OR IGNORE INTO client_job_cards(job_id,user_id,customer_id,payment_method_id,card_id)
      SELECT j.id,u.id,c.customer_id,c.payment_method_id,c.id FROM jobs j JOIN users u ON u.id=j.client_id
      JOIN client_saved_cards c ON c.user_id=u.id AND c.customer_id=u.stripe_customer_id AND c.payment_method_id=u.stripe_payment_method_id
      WHERE j.status='waiting' AND c.slot IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM payment_authorization_attempts a WHERE a.job_id=j.id)`);
  }).immediate();
}

export function activeCards(db: Database,userId: string): SavedCard[] {
  return db.prepare(`SELECT c.* FROM client_saved_cards c JOIN users u ON u.id=c.user_id
    WHERE c.user_id=? AND c.customer_id=u.stripe_customer_id AND c.slot IS NOT NULL ORDER BY c.slot`).all(userId) as SavedCard[];
}

function insertCard(db: Database,userId: string,customerId: string,methodId: string) {
  const used = activeCards(db,userId).map(c=>c.slot);
  const slot = [1,2,3].find(n=>!used.includes(n));
  if (!slot) throw new CardSetupError("Ai deja 3 carduri salvate. Elimină unul înainte să adaugi un card nou.");
  const id = `card_${randomUUID()}`;
  db.prepare("INSERT INTO client_saved_cards(id,user_id,customer_id,payment_method_id,slot) VALUES(?,?,?,?,?)").run(id,userId,customerId,methodId,slot);
  return id;
}

export function updateCardDetails(db: Database,cardId: string,details: CardDetails) {
  db.prepare("UPDATE client_saved_cards SET brand=?,last4=?,exp_month=?,exp_year=?,fingerprint=? WHERE id=?")
    .run(details.brand,details.last4,details.exp_month,details.exp_year,details.fingerprint??null,cardId);
}

/** Caller has verified session, SetupIntent, customer and payment method at Stripe. */
export function saveConfirmedCard(db: Database,userId: string,customerId: string,methodId: string,sessionId: string,details: CardDetails): string {
  return db.transaction(() => {
    const user = db.prepare("SELECT stripe_customer_id,stripe_payment_method_id FROM users WHERE id=?").get(userId) as {stripe_customer_id:string;stripe_payment_method_id:string|null}|undefined;
    if (user?.stripe_customer_id!==customerId) throw new CardSetupError("Contul de plată s-a schimbat. Reîncearcă.");
    const previous = db.prepare("SELECT user_id,card_id FROM client_card_setup_results WHERE session_id=?").get(sessionId) as {user_id:string;card_id:string}|undefined;
    const cards = activeCards(db,userId);
    if (previous) {
      if (previous.user_id!==userId || !cards.some(c=>c.id===previous.card_id)) throw new CardSetupError("Acest card a fost eliminat. Pornește o nouă adăugare dacă dorești să îl salvezi din nou.");
      return previous.card_id;
    }
    const duplicate = cards.find(c=>c.payment_method_id===methodId || (details.fingerprint && c.fingerprint===details.fingerprint));
    let cardId = duplicate?.id;
    if (!cardId) {
      // Keep old customer references out of the current customer's three slots.
      db.prepare("UPDATE client_saved_cards SET slot=NULL WHERE user_id=? AND customer_id<>?").run(userId,customerId);
      const retired = db.prepare("SELECT id FROM client_saved_cards WHERE user_id=? AND customer_id=? AND payment_method_id=? AND slot IS NULL").get(userId,customerId,methodId) as {id:string}|undefined;
      if (retired) {
        const slot = [1,2,3].find(n=>!cards.some(c=>c.slot===n));
        if (!slot) throw new CardSetupError("Ai deja 3 carduri salvate. Elimină unul înainte să adaugi un card nou.");
        db.prepare("UPDATE client_saved_cards SET slot=? WHERE id=?").run(slot,retired.id); cardId=retired.id;
      } else cardId=insertCard(db,userId,customerId,methodId);
      updateCardDetails(db,cardId,details);
    }
    db.prepare("INSERT INTO client_card_setup_results(session_id,user_id,card_id) VALUES(?,?,?)").run(sessionId,userId,cardId);
    // Adding a card must not change an existing default, even from another tab.
    if (!user.stripe_payment_method_id) {
      const saved = db.prepare("SELECT payment_method_id FROM client_saved_cards WHERE id=?").get(cardId) as {payment_method_id:string};
      db.prepare("UPDATE users SET stripe_payment_method_id=? WHERE id=? AND stripe_customer_id=? AND stripe_payment_method_id IS NULL").run(saved.payment_method_id,userId,customerId);
    }
    return cardId;
  }).immediate();
}

export function setDefaultCard(db: Database,userId: string,cardId: string) {
  db.transaction(()=>{
    const card=activeCards(db,userId).find(c=>c.id===cardId);
    if (!card) throw new CardSetupError("Cardul nu este disponibil în contul tău.",404);
    db.prepare("UPDATE users SET stripe_payment_method_id=? WHERE id=? AND stripe_customer_id=?").run(card.payment_method_id,userId,card.customer_id);
  }).immediate();
}

export function removeSavedCard(db: Database,userId: string,cardId: string) {
  db.transaction(()=>{
    const card=activeCards(db,userId).find(c=>c.id===cardId);
    if (!card) throw new CardSetupError("Cardul nu este disponibil în contul tău.",404);
    if (db.prepare("SELECT 1 FROM client_job_cards c JOIN jobs j ON j.id=c.job_id WHERE c.user_id=? AND c.payment_method_id=? AND j.status='waiting'").get(userId,card.payment_method_id)) {
      throw new CardSetupError("Cardul este ales pentru o lucrare în așteptare. Îl poți elimina după preluarea sau anularea lucrării.");
    }
    db.prepare("UPDATE client_saved_cards SET slot=NULL WHERE id=? AND user_id=?").run(card.id,userId);
    const next = activeCards(db,userId)[0];
    db.prepare("UPDATE users SET stripe_payment_method_id=? WHERE id=? AND stripe_payment_method_id=?").run(next?.payment_method_id??null,userId,card.payment_method_id);
  }).immediate();
}

/** Called in the same transaction as publication. No card identifiers enter the firm's job response. */
export function saveJobCard(db: Database,userId: string,jobId: string,cardId?: unknown) {
  if (cardId!==undefined && cardId!==null && (typeof cardId!=="string" || cardId.length>100)) throw new CardSetupError("Alege un card valid.",400);
  const user = db.prepare("SELECT stripe_payment_method_id FROM users WHERE id=?").get(userId) as {stripe_payment_method_id:string|null}|undefined;
  const card = activeCards(db,userId).find(c=>cardId ? c.id===cardId : c.payment_method_id===user?.stripe_payment_method_id);
  if (!card) throw new CardSetupError("Alege un card disponibil în contul tău înainte de publicare.",402);
  db.prepare("INSERT INTO client_job_cards(job_id,user_id,customer_id,payment_method_id,card_id) VALUES(?,?,?,?,?)").run(jobId,userId,card.customer_id,card.payment_method_id,card.id);
}

/** Freeze legacy/recurring jobs on their first authorization; retries retain the original request. */
export function authorizationCard(db: Database,jobId: string): {customerId:string;paymentMethodId:string} {
  return db.transaction(()=>{
    const saved=db.prepare("SELECT customer_id AS customerId,payment_method_id AS paymentMethodId FROM client_job_cards WHERE job_id=?").get(jobId) as {customerId:string;paymentMethodId:string}|undefined;
    if(saved)return saved;
    const client=db.prepare("SELECT u.id,u.stripe_customer_id,u.stripe_payment_method_id FROM jobs j JOIN users u ON u.id=j.client_id WHERE j.id=?").get(jobId) as {id:string;stripe_customer_id:string|null;stripe_payment_method_id:string|null}|undefined;
    const attempt=db.prepare("SELECT request_json FROM payment_authorization_attempts WHERE job_id=?").get(jobId) as {request_json:string}|undefined;
    const original=attempt?JSON.parse(attempt.request_json):null;
    const customerId=original?.customer??client?.stripe_customer_id;
    const paymentMethodId=original?.payment_method??client?.stripe_payment_method_id;
    if(!client||typeof customerId!=="string"||!customerId||typeof paymentMethodId!=="string"||!paymentMethodId)throw new CardSetupError("Clientul nu are un card salvat pentru această lucrare",402);
    db.prepare("INSERT INTO client_job_cards(job_id,user_id,customer_id,payment_method_id) VALUES(?,?,?,?)").run(jobId,client.id,customerId,paymentMethodId);
    return {customerId,paymentMethodId};
  }).immediate();
}
