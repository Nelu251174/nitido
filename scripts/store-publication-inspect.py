"""Inspect existing store accounts in CI; emit public metadata only, no credentials."""
import datetime, json, os, pathlib, time, urllib.parse, urllib.request, urllib.error

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

def apple_get(token, path):
    url = path if path.startswith('https://') else 'https://api.appstoreconnect.apple.com' + path
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or parsed.netloc != 'api.appstoreconnect.apple.com':
        raise ValueError('Unexpected Apple pagination origin')
    request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token})
    with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
        return json.load(response)

def apple_rows(token, path):
    rows = []
    for _ in range(50):
        document = apple_get(token, path)
        rows.extend(document['data'])
        path = document.get('links', {}).get('next')
        if not path:
            return rows
    raise ValueError('Apple pagination limit exceeded')

def apple_inspect():
    import jwt
    required = ['ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_PRIVATE_KEY', 'APPLE_TEAM_ID']
    if not all(os.environ.get(key) for key in required):
        return {'available': False, 'reason': 'Apple publishing bindings incomplete'}
    token = jwt.encode({'iss': os.environ['ASC_ISSUER_ID'], 'iat': int(time.time()),
        'exp': int(time.time()) + 600, 'aud': 'appstoreconnect-v1'},
        os.environ['ASC_PRIVATE_KEY'], algorithm='ES256',
        headers={'kid': os.environ['ASC_KEY_ID'], 'typ': 'JWT'})
    apps = apple_rows(token, '/v1/apps?filter%5BbundleId%5D=ro.nitido.app&limit=2')
    if len(apps) != 1 or apps[0]['attributes']['bundleId'] != 'ro.nitido.app':
        raise ValueError('Exact existing Apple app unavailable')
    app = apps[0]
    app_id = urllib.parse.quote(app['id'], safe='')
    builds = apple_rows(token, '/v1/builds?filter%5Bapp%5D=' + app_id + '&limit=200')
    versions = apple_rows(token, '/v1/apps/' + app_id + '/appStoreVersions?limit=200')
    groups = apple_rows(token, '/v1/apps/' + app_id + '/betaGroups?limit=200')
    codes = [int(b['attributes']['version']) for b in builds]
    def readiness(path, required):
        try:
            fields = apple_get(token, path)['data']['attributes']
            return {'available': True, 'missingFields': [key for key in required if not fields.get(key)],
                'demoAccountRequired': fields.get('demoAccountRequired'),
                'demoAccountProvided': bool(fields.get('demoAccountName') and fields.get('demoAccountPassword')),
                'notesProvided': bool(fields.get('notes'))}
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return {'available': False, 'missingFields': required}
            return {'available': False, 'httpStatus': error.code}
    contact_fields = ['contactFirstName', 'contactLastName', 'contactEmail', 'contactPhone']
    beta_review = readiness('/v1/apps/' + app_id + '/betaAppReviewDetail', contact_fields)
    for version in versions:
        version['readiness'] = readiness('/v1/appStoreVersions/' + version['id'] + '/appStoreReviewDetail', contact_fields)
    beta_info = apple_rows(token, '/v1/apps/' + app_id + '/betaAppLocalizations?limit=200')
    beta_info_flags = [{'locale': item['attributes']['locale'],
        'missingFields': [key for key in ['description', 'feedbackEmail', 'privacyPolicyUrl'] if not item['attributes'].get(key)]} for item in beta_info]
    return {'available': True, 'authenticated': True, 'appId': app['id'],
        'bundleId': app['attributes']['bundleId'], 'name': app['attributes']['name'],
        'highestBuild': max(codes, default=0), 'betaReviewReadiness': beta_review, 'betaInformation': beta_info_flags,
        'builds': [{'id': b['id'], **{k: b['attributes'].get(k) for k in
            ['version', 'processingState', 'uploadedDate', 'usesNonExemptEncryption']}} for b in builds],
        'versions': [{'id': v['id'], 'reviewReadiness': v['readiness'], **{k: v['attributes'].get(k) for k in
            ['versionString', 'appStoreState', 'platform']}} for v in versions],
        'groups': [{'id': g['id'], **{k: g['attributes'].get(k) for k in
            ['isInternalGroup', 'publicLinkEnabled', 'publicLink']}} for g in groups]}

def play_inspect():
    if not os.environ.get('GOOGLE_PLAY_JSON'):
        return {'available': False, 'reason': 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON not configured'}
    from google.oauth2 import service_account
    from google.auth.transport.requests import AuthorizedSession
    credentials = service_account.Credentials.from_service_account_info(
        json.loads(os.environ['GOOGLE_PLAY_JSON']),
        scopes=['https://www.googleapis.com/auth/androidpublisher'])
    session = AuthorizedSession(credentials)
    base = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/ro.nitido.app/edits'
    edit = None
    def require(response):
        if response.status_code != 200:
            raise ValueError('Current Play package access failed HTTP' + str(response.status_code))
        return response.json()
    try:
        edit = require(session.post(base, json={}, timeout=30))['id']
        tracks = require(session.get(base + '/' + edit + '/tracks', timeout=30)).get('tracks', [])
        codes = []
        for resource in ['bundles', 'apks']:
            for item in require(session.get(base + '/' + edit + '/' + resource, timeout=30)).get(resource, []):
                codes.append(int(item['versionCode']))
        sanitized = []
        for track in tracks:
            releases = []
            for release in track.get('releases', []):
                codes.extend(int(c) for c in release.get('versionCodes', []))
                releases.append({k: release.get(k) for k in ['status', 'versionCodes']})
            sanitized.append({'track': track['track'], 'releases': releases})
        return {'available': True, 'authenticated': True, 'package': 'ro.nitido.app',
            'highestBuild': max(codes, default=0), 'betaReviewReadiness': beta_review, 'betaInformation': beta_info_flags, 'tracks': sanitized}
    finally:
        if edit:
            response = session.delete(base + '/' + edit, timeout=30)
            if response.status_code not in [200, 204]:
                raise ValueError('Temporary Play inspection edit cleanup failed')

if __name__ == '__main__':
    platform = os.environ['STORE_PLATFORM']
    result = {'platform': platform, 'verifiedAt': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    try:
        result.update(apple_inspect() if platform == 'ios' else play_inspect())
    except urllib.error.HTTPError as error:
        result.update({'available': True, 'authenticated': False, 'reason': 'Store API HTTP' + str(error.code)})
    except Exception as error:
        # Exceptions can contain private configuration: expose type only.
        result.update({'authenticated': False, 'reason': type(error).__name__})
    destination = pathlib.Path(os.environ['STORE_REPORT'])
    destination.write_text(json.dumps(result, indent=2))
    print(json.dumps(result))
