"""Associate verified uploaded build16 with existing internal TestFlight groups."""
import datetime, json, os, pathlib, time, urllib.parse, urllib.request, urllib.error
import jwt

token = jwt.encode({'iss': os.environ['ASC_ISSUER_ID'], 'iat': int(time.time()),
    'exp': int(time.time()) + 1200, 'aud': 'appstoreconnect-v1'},
    os.environ['ASC_PRIVATE_KEY'], algorithm='ES256',
    headers={'kid': os.environ['ASC_KEY_ID'], 'typ': 'JWT'})

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

def api(path, method='GET', value=None):
    assert path.startswith('/v1/') and '://' not in path
    body = None if value is None else json.dumps(value).encode()
    request = urllib.request.Request('https://api.appstoreconnect.apple.com' + path,
        method=method, data=body, headers={'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'})
    with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
        content = response.read()
        return json.loads(content) if content else {}

app_id = '6810752486'
assert api('/v1/apps/' + app_id)['data']['attributes']['bundleId'] == 'ro.nitido.app'
version = '16'
build = None
for _ in range(20):
    rows = api('/v1/builds?filter%5Bapp%5D=' + app_id + '&filter%5Bversion%5D=' + version + '&limit=2')['data']
    assert len(rows) <= 1
    build = rows[0] if rows else None
    if build:
        state = build['attributes']['processingState']
        if state in ['INVALID', 'FAILED']:
            raise SystemExit('Apple processing rejected the uploaded build')
        if state == 'VALID':
            break
    time.sleep(30)
else:
    raise SystemExit('Apple processing pending; no group changed')
assert build['attributes']['version'] == version
assert build['attributes'].get('usesNonExemptEncryption') is False
groups = api('/v1/apps/' + app_id + '/betaGroups?limit=200')['data']
internal = [g for g in groups if g['attributes'].get('isInternalGroup') is True]
assert internal, 'No existing internal TestFlight group; no new users invited'
assigned = []
for group in internal:
    gid = urllib.parse.quote(group['id'], safe='')
    existing = api('/v1/betaGroups/' + gid + '/relationships/builds?limit=200').get('data', [])
    if any(item['id'] == build['id'] for item in existing):
        assigned.append(group['id'])
        continue
    try:
        api('/v1/betaGroups/' + gid + '/relationships/builds', 'POST',
            {'data': [{'type': 'builds', 'id': build['id']}]})
        assigned.append(group['id'])
    except urllib.error.HTTPError as error:
        body = json.loads(error.read())
        print(json.dumps({'groupId': group['id'], 'httpStatus': error.code,
            'errors': [{key: item.get(key) for key in ['code', 'title', 'detail']} for item in body.get('errors', [])]}))
        raise SystemExit('TestFlight group assignment requires follow-up; no public release claimed')
details = api('/v1/builds/' + build['id'] + '/buildBetaDetail')['data']['attributes']
result = {'appId': app_id, 'bundleId': 'ro.nitido.app', 'build': version,
    'buildId': build['id'], 'processingState': 'VALID', 'existingInternalGroups': assigned,
    'internalBuildState': details.get('internalBuildState'),
    'externalBuildState': details.get('externalBuildState'),
    'newUsersInvited': False, 'publicAppStoreRelease': False,
    'verifiedAt': datetime.datetime.now(datetime.timezone.utc).isoformat()}
pathlib.Path(os.environ['STORE_REPORT']).write_text(json.dumps(result, indent=2))
print(json.dumps(result))
