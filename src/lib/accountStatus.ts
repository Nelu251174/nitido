import type {Database} from 'better-sqlite3';

export function hasRemovedAccounts(db:Database):boolean {
 return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='admin_removed_accounts'").get();
}
export function isAccountRemoved(db:Database,userId:string):boolean {
 return hasRemovedAccounts(db)&&!!db.prepare('SELECT 1 FROM admin_removed_accounts WHERE user_id=?').get(userId);
}
/** Internal SQL expressions only; never interpolate request input here. Compatible with older databases. */
export function activeAccountSql(db:Database,userExpression:string):string {
 if(!/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?$/.test(userExpression))throw Error('INVALID_ACCOUNT_SQL_EXPRESSION');
 return hasRemovedAccounts(db)?`NOT EXISTS(SELECT 1 FROM admin_removed_accounts removed_account WHERE removed_account.user_id=${userExpression})`:'1=1';
}
export function activeFirmSql(db:Database,firmExpression:string):string {
 if(!/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?$/.test(firmExpression))throw Error('INVALID_FIRM_SQL_EXPRESSION');
 return hasRemovedAccounts(db)?`NOT EXISTS(SELECT 1 FROM admin_removed_accounts removed_firm WHERE removed_firm.kind='firm' AND removed_firm.target_id=${firmExpression})`:'1=1';
}

const REMOVED_ACCOUNT_EMAIL_SCHEMA=`CREATE TABLE IF NOT EXISTS admin_removed_account_emails(
 user_id TEXT PRIMARY KEY REFERENCES admin_removed_accounts(user_id),email TEXT NOT NULL,archived_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS admin_removed_account_emails_immutable_update BEFORE UPDATE ON admin_removed_account_emails BEGIN SELECT RAISE(ABORT,'Removed contact history is retained');END;
CREATE TRIGGER IF NOT EXISTS admin_removed_account_emails_immutable_delete BEFORE DELETE ON admin_removed_account_emails BEGIN SELECT RAISE(ABORT,'Removed contact history is retained');END;`;
/** Called only within signup's write transaction. New registrations never inherit the removed identity. */
export function releaseRemovedAccountEmail(db:Database,email:string){
 if(!db.inTransaction)throw Error('REMOVED_EMAIL_REQUIRES_TRANSACTION');
 const previous=db.prepare('SELECT id,email FROM users WHERE email = ? COLLATE NOCASE').all(email.trim()) as {id:string;email:string}[];
 if(previous.some(u=>!isAccountRemoved(db,u.id)))throw Error('SIGNUP_EMAIL_IN_USE');
 if(!previous.length)return;
 db.exec(REMOVED_ACCOUNT_EMAIL_SCHEMA);
 for(const user of previous){
  db.prepare('INSERT OR IGNORE INTO admin_removed_account_emails(user_id,email,archived_at) VALUES(?,?,?)').run(user.id,user.email,new Date().toISOString());
  const archived=db.prepare('SELECT email FROM admin_removed_account_emails WHERE user_id=?').get(user.id) as {email:string};
  if(archived.email!==user.email)throw Error('REMOVED_EMAIL_HISTORY_MISMATCH');
  const changed=db.prepare('UPDATE users SET email=NULL WHERE id=? AND email=?').run(user.id,user.email);
  if(changed.changes!==1)throw Error('REMOVED_EMAIL_RELEASE_CONFLICT');
 }
}
