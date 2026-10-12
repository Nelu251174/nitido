"""Wait for the uploaded correction, then prepare the rejected version. No review submission or messages."""
import datetime,json,os,pathlib,time,urllib.parse,urllib.request,urllib.error
import jwt
token=jwt.encode({'iss':os.environ['ASC_ISSUER_ID'],'iat':int(time.time()),'exp':int(time.time())+900,'aud':'appstoreconnect-v1'},pathlib.Path(os.environ['ASC_KEY_PATH']).read_text(),algorithm='ES256',headers={'kid':os.environ['ASC_KEY_ID'],'typ':'JWT'})
def api(path,method='GET',data=None):
 req=urllib.request.Request('https://api.appstoreconnect.apple.com'+path,method=method,data=None if data is None else json.dumps(data).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=25) as r:
  raw=r.read();return json.loads(raw) if raw else None
result={'appId':'6810752486','buildNumber':17,'sourceSha':os.environ['NITIDO_SOURCE_SHA'],'uploaded':True,'processingState':'not_seen','selectedForVersion':False,'submittedToReview':False,'messagesSent':False}
def save():
 result['verifiedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
 pathlib.Path(os.environ['RUNNER_TEMP'],'ios-review-build-state.json').write_text(json.dumps(result,indent=2))
save()
build=None
for attempt in range(24):
 rows=api('/v1/builds?filter%5Bapp%5D=6810752486&filter%5Bversion%5D=17&limit=200')['data']
 assert len(rows)<=1,'Ambiguous uploaded build'
 if rows:
  build=rows[0];result['buildId']=build['id'];result['processingState']=build['attributes']['processingState'];save()
  if result['processingState'] in ['VALID','FAILED','INVALID']:break
 print('Apple processing state: '+result['processingState'],flush=True)
 time.sleep(15)
if not build or result['processingState']!='VALID':
 print('Uploaded build still processing or requires attention; no version edit performed',flush=True)
 raise SystemExit(0)
versions=api('/v1/apps/6810752486/appStoreVersions?limit=200')['data']
matches=[v for v in versions if v['attributes']['platform']=='IOS' and v['attributes']['versionString']=='1.0']
assert len(matches)==1,'Exact review version not found'
version=matches[0];result['versionId']=version['id'];result['versionState']=version['attributes']['appStoreState'];save()
if result['versionState'] not in ['REJECTED','METADATA_REJECTED','PREPARE_FOR_SUBMISSION','DEVELOPER_REJECTED']:
 print('Review state changed; no version edit performed',flush=True)
 raise SystemExit(0)
path='/v1/appStoreVersions/'+urllib.parse.quote(version['id'],safe='')+'/relationships/build'
current=api(path)['data']
if current and current['id']==build['id']:
 result['selectedForVersion']=True;save();raise SystemExit(0)
if not current or current['id']!='5118fe93-f0c9-45ca-994c-90eef0bf4ad7':
 print('Current selection changed; no version edit performed',flush=True)
 raise SystemExit(0)
api(path,'PATCH',{'data':{'type':'builds','id':build['id']}})
assert api(path)['data']['id']==build['id']
result['selectedForVersion']=True;save()
print('Valid build17 selected for iOS1.0; no public review submission or message sent',flush=True)
