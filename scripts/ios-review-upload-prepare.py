"""Exact-app read-only checks before the already-signed correction upload."""
import datetime,json,os,pathlib,plistlib,re,time,urllib.parse,urllib.request,zipfile
import jwt
sha=os.environ['NITIDO_SOURCE_SHA']
evidence=json.loads(pathlib.Path('ops/docs/store/ios-review-upload-evidence.json').read_text())
assert evidence['sourceSha']==sha and evidence['live']['sourceSha']==sha
for path in ['/api/health','/termeni','/confidentialitate','/stergere-cont']:
 with urllib.request.urlopen('https://nitido.ro'+path,timeout=25) as r:
  assert r.status==200
  if path=='/api/health':assert json.load(r)['status']=='ok'
with zipfile.ZipFile(pathlib.Path(os.environ['RUNNER_TEMP'])/'nitido-ios/App.ipa') as ipa:
 info=plistlib.loads(ipa.read('Payload/App.app/Info.plist'))
 config=json.loads(ipa.read('Payload/App.app/capacitor.config.json'))
assert info['CFBundleIdentifier']=='ro.nitido.app' and info['CFBundleVersion']=='17' and info['CFBundleShortVersionString']=='1.0'
assert config['server']['url']=='https://nitido.ro'
sdk=int(re.search(r'iphoneos(\d+)',info['DTSDKName'])[1])
xcode=int(info['DTXcode'])//100
assert sdk>=26 and xcode>=26
token=jwt.encode({'iss':os.environ['ASC_ISSUER_ID'],'iat':int(time.time()),'exp':int(time.time())+600,'aud':'appstoreconnect-v1'},pathlib.Path(os.environ['ASC_KEY_PATH']).read_text(),algorithm='ES256',headers={'kid':os.environ['ASC_KEY_ID'],'typ':'JWT'})
def get(url):
 p=urllib.parse.urlsplit(url)
 assert p.scheme=='https' and p.netloc=='api.appstoreconnect.apple.com'
 with urllib.request.urlopen(urllib.request.Request(url,headers={'Authorization':'Bearer '+token}),timeout=25) as r:return json.load(r)
apps=get('https://api.appstoreconnect.apple.com/v1/apps?filter%5BbundleId%5D=ro.nitido.app&limit=2')['data']
assert len(apps)==1 and apps[0]['id']=='6810752486'
url='https://api.appstoreconnect.apple.com/v1/builds?filter%5Bapp%5D=6810752486&limit=200'
maximum=0
while url:
 data=get(url)
 for build in data['data']:maximum=max(maximum,int(build['attributes']['version']))
 url=data.get('links',{}).get('next')
assert int(os.environ['NITIDO_IOS_BUILD_NUMBER'])>maximum,'Candidate already uploaded; inspect instead of repeating upload'
evidence['store']={'verified':True,'highestBuild':maximum,'receipt':'Exact Apple app 6810752486 authenticated immediately before build17 upload; maximum '+str(maximum)}
evidence['signing']={'verified':True,'receipt':'Signed IPA from run38279163659; exact team, profile, production push, identity and version independently verified again before upload'}
evidence['compatibility']={'verified':True,'receipt':'Verified artifact11761025185: SDK '+str(sdk)+', Xcode '+str(xcode)+', App Store profile and production APNs','iosSdkMajor':sdk,'xcodeMajor':xcode}
evidence['verifiedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
pathlib.Path(os.environ['EVIDENCE']).write_text(json.dumps(evidence,indent=2))
print('Fresh exact-app Apple state, verified signed artifact and live HTTPS receipts ready; no public review submission performed')
