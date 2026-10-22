export const AVAILABILITY_ALERTS_SCHEMA=`
CREATE TABLE IF NOT EXISTS availability_subscriptions(
 id TEXT PRIMARY KEY,client_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 fingerprint TEXT NOT NULL,criteria_json TEXT NOT NULL,channels_json TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1,consent_at TEXT NOT NULL,expires_at TEXT NOT NULL,created_ms INTEGER NOT NULL,last_checked_ms INTEGER NOT NULL DEFAULT 0,
 UNIQUE(client_id,fingerprint)
);
CREATE INDEX IF NOT EXISTS availability_subscriptions_active ON availability_subscriptions(active,expires_at);
CREATE TABLE IF NOT EXISTS availability_alert_batches(
 id TEXT PRIMARY KEY,client_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,day_key TEXT NOT NULL,created_ms INTEGER NOT NULL,
 UNIQUE(client_id,day_key)
);
CREATE TABLE IF NOT EXISTS availability_alert_items(
 batch_id TEXT NOT NULL REFERENCES availability_alert_batches(id) ON DELETE CASCADE,subscription_id TEXT NOT NULL REFERENCES availability_subscriptions(id) ON DELETE CASCADE,
 slot_id TEXT NOT NULL REFERENCES provider_open_slots(id),revision INTEGER NOT NULL,starts_at TEXT NOT NULL,
 PRIMARY KEY(subscription_id,slot_id,revision,starts_at)
);
CREATE TABLE IF NOT EXISTS availability_alert_deliveries(
 id TEXT PRIMARY KEY,batch_id TEXT NOT NULL REFERENCES availability_alert_batches(id) ON DELETE CASCADE,channel TEXT NOT NULL CHECK(channel IN ('inapp','email','push')),
 device_id TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,
 claim TEXT,claimed_ms INTEGER,dispatch_ms INTEGER,next_ms INTEGER NOT NULL DEFAULT 0,last_error TEXT,sent_ms INTEGER,
 UNIQUE(batch_id,channel,device_id)
);
CREATE INDEX IF NOT EXISTS availability_alert_delivery_due ON availability_alert_deliveries(status,next_ms);
`;
