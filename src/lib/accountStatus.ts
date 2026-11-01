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
