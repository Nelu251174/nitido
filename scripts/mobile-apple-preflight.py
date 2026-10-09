#!/usr/bin/env python3
"""Read-only App Store Connect authentication, exact identity and build maximum."""
import json, os, pathlib, time, urllib.parse, urllib.request
import jwt
key_id = os.environ['ASC_KEY_ID']
issuer = os.environ['ASC_ISSUER_ID']
token = jwt.encode({'iss':issuer,'iat':int(time.time()),'exp':int(time.time())+600,'aud':'appstoreconnect-v1'},pathlib.Path(os.environ['ASC_KEY_PATH']).read_text(),algorithm='ES256',headers={'kid':key_id,'typ':'JWT'})
def get(url):
    # Never follow a pagination URL outside the authenticated Apple API.
    if urllib.parse.urlparse(url).scheme != 'https' or urllib.parse.urlparse(url).netloc != 'api.appstoreconnect.apple.com':
        raise SystemExit('Invalid Apple API pagination origin')
    with urllib.request.urlopen(urllib.request.Request(url,headers={'Authorization':'Bearer '+token}),timeout=30) as response:
        return json.load(response)
apps=get('https://api.appstoreconnect.apple.com/v1/apps?filter%5BbundleId%5D=ro.nitido.app&limit=2')['data']
if len(apps)!=1 or apps[0]['attributes']['bundleId']!='ro.nitido.app': raise SystemExit('Exact Apple bundle identity not accessible')
app_id=apps[0]['id']
url='https://api.appstoreconnect.apple.com/v1/builds?filter%5Bapp%5D='+urllib.parse.quote(app_id)+'&limit=200'
maximum=0
while url:
    data=get(url)
    for build in data['data']:
        code=build['attributes']['version']
        if not str(code).isdigit(): raise SystemExit('Existing non-integer Apple build version needs explicit review')
        maximum=max(maximum,int(code))
    url=data.get('links',{}).get('next')
version=int(os.environ['NITIDO_IOS_BUILD_NUMBER'])
if version<=maximum: raise SystemExit('iOS build number must exceed current authenticated Apple maximum')
if os.environ.get('VERIFY_UPLOAD_EVIDENCE') == 'true':
    evidence=json.loads(pathlib.Path(os.environ['EVIDENCE']).read_text())
    if evidence['store']['highestBuild']!=maximum: raise SystemExit('Apple evidence maximum does not match current authenticated state')
print('Exact Apple app authenticated; candidate build exceeds current build maximum')
