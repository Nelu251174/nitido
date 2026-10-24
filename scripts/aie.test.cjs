const {test}=require('node:test');
const assert=require('node:assert/strict');
const {unchangedCredentials,validate}=require('./aie.cjs');
const fixture={NEXT_PUBLIC_SITE_URL:'https://nitido.ro',NITIDO_ADMIN_EMAIL:'old@example.test',NITIDO_ADMIN_PASSWORD_HASH:'synthetic-password-hash',NITIDO_ADMIN_PASSWORD:'',NITIDO_ADMIN_TOTP_SECRET:'synthetic-factor',NITIDO_ADMIN_RECOVERY_HASHES:'synthetic-recovery'};
test('confirmed email correction preserves the password and MFA fingerprint',()=>assert.equal(validate(fixture,false),validate({...fixture,NITIDO_ADMIN_EMAIL:'support@nitido.ro'},false)));
for(const key of ['NITIDO_ADMIN_PASSWORD_HASH','NITIDO_ADMIN_PASSWORD','NITIDO_ADMIN_TOTP_SECRET','NITIDO_ADMIN_RECOVERY_HASHES'])test('detects an unintended change to '+key,()=>assert.notEqual(unchangedCredentials(fixture),unchangedCredentials({...fixture,[key]:'different-fixture'})));
test('refuses to discard an existing recovered password',()=>assert.throws(()=>validate(fixture,true),/PERSISTED_PASSWORD_REQUIRES_MIGRATION/));
test('refuses another application scope',()=>assert.throws(()=>validate({...fixture,NEXT_PUBLIC_SITE_URL:'https://sandbox.nitido.ro'},false),/WRONG_TARGET/));
test('refuses missing password or MFA configuration',()=>{assert.throws(()=>validate({...fixture,NITIDO_ADMIN_PASSWORD_HASH:''},false),/ADMIN_SECURITY_NOT_CONFIGURED/);assert.throws(()=>validate({...fixture,NITIDO_ADMIN_TOTP_SECRET:''},false),/ADMIN_SECURITY_NOT_CONFIGURED/)});
