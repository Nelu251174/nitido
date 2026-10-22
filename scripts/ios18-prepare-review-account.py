"""Create encrypted verifier handoff for one dedicated review client; no plaintext credential export."""
import base64
import importlib.util
import json
import pathlib
import secrets
import bcrypt
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

spec = importlib.util.spec_from_file_location('release', pathlib.Path(__file__).with_name('ios18-release-control.py'))
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)
r.identity()
versions = [v for v in r.rows('/v1/apps/' + r.APP + '/appStoreVersions?limit=200')
            if v['attributes']['versionString'] == '1.0.1' and v['attributes']['platform'] == 'IOS']
assert len(versions) == 1 and versions[0]['attributes']['appStoreState'] in ['PREPARE_FOR_SUBMISSION', 'READY_FOR_REVIEW']
version = versions[0]
selected = r.apple('/v1/appStoreVersions/' + version['id'] + '/build')['data']
assert selected['attributes']['version'] == '18' and selected['attributes']['processingState'] == 'VALID'
detail = r.apple('/v1/appStoreVersions/' + version['id'] + '/appStoreReviewDetail')['data']
email = 'apple-review-ios18@nitido.ro'
password = 'Aa7' + secrets.token_urlsafe(24)
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()
payload = json.dumps({'e': email, 'h': hashed, 'p': detail['attributes'].get('contactPhone') or None}, separators=(',', ':')).encode()
public_key = serialization.load_pem_public_key(pathlib.Path('docs/store/ios18-review-repair-public.pem').read_bytes())
ciphertext = public_key.encrypt(payload, padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))
notes = detail['attributes'].get('notes') or ''
notes += '\n\nDedicated client review account: use the current Demo Account Name and Demo Account Password fields above. They replace earlier client credentials in these notes. No real payment is needed to inspect the booking setup.'
r.apple('/v1/appStoreReviewDetails/' + detail['id'], 'PATCH', {'data': {
    'type': 'appStoreReviewDetails', 'id': detail['id'], 'attributes': {
        'demoAccountName': email, 'demoAccountPassword': password, 'demoAccountRequired': True, 'notes': notes}}})
print(json.dumps({'reviewCredentialVerifierEnvelope': base64.b64encode(ciphertext).decode(),
                  'algorithm': 'RSA-OAEP-SHA256', 'containsPlaintextPassword': False,
                  'appReviewDraftUpdated': True}))
