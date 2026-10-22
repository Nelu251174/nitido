const key=process.env.STRIPE_SECRET_KEY||'';
if(!/^(?:sk|rk)_test_/.test(key))throw Error('TEST_MODE_CREDENTIAL_NOT_CONFIGURED');
console.log('TEST_MODE_CREDENTIAL_CONFIGURED');
