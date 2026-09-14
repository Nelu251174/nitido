import type {Database} from 'better-sqlite3';
import {recoverNotificationClaims} from './notificationClaims';
import {processPushOutbox,PUSH_RETRYABLE_SQL,pushEnabled,smsFallbackEnabled} from './push';
import {processSmsOutbox,SMS_RETRYABLE_SQL} from './notifications';
import {smsProviderConfigured} from './sms';

export const notificationRecoveryConfigured=()=>process.env.NITIDO_NOTIFICATION_RECOVERY_ENABLED==='true'&&process.env.NEXT_PUBLIC_SITE_URL==='https://sandbox.nitido.ro';

/** Bounded batches: at most one push and one SMS row per tick; claims serialize overlapping ticks. */
export async function runNotificationRecovery(db:Database){
 const recovery=recoverNotificationClaims(db);
 const smsReady=smsFallbackEnabled()&&smsProviderConfigured();
 const apnsReady=['APNS_KEY_ID','APNS_TEAM_ID','APNS_PRIVATE_KEY','APNS_BUNDLE_ID'].every(key=>Boolean(process.env[key]));
 const fcmReady=['FIREBASE_PROJECT_ID','FIREBASE_CLIENT_EMAIL','FIREBASE_PRIVATE_KEY'].every(key=>Boolean(process.env[key]));
 const pushReady=(pushEnabled()&&(apnsReady||fcmReady))||smsReady;
 const push=pushReady?db.prepare(`SELECT id FROM push_notification_outbox WHERE ${PUSH_RETRYABLE_SQL} ORDER BY created_at,rowid LIMIT 1`).all() as {id:string}[]:[];
 if(push.length)await processPushOutbox(db,push.map(row=>row.id));
 const sms=smsReady?db.prepare(`SELECT id FROM notification_outbox WHERE ${SMS_RETRYABLE_SQL} ORDER BY created_at,rowid LIMIT 1`).all() as {id:string}[]:[];
 if(sms.length)await processSmsOutbox(db,sms.map(row=>row.id));
 return {status:'completed' as const,...recovery,pushSelected:push.length,smsSelected:sms.length};
}
