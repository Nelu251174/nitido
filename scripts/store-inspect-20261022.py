"""Current exact store identity/state; no submission or committed Play edit."""
import datetime,json,os,pathlib,time,urllib.request,urllib.parse,urllib.error
OUT=pathlib.Path(os.environ['RUNNER_TEMP'])/'nitido-current-store-state.json'
report={'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'appId':'ro.nitido.app','scope':'Read Apple metadata and Play tracks; temporary Play edit is always deleted; no release committed','signingConfigured':{'appleTeam':bool(os.getenv('APPLE_TEAM_ID')),'androidKey':bool(os.getenv('NITIDO_KEYSTORE_BASE64')),'androidPassword':bool(os.getenv('NITIDO_KEYSTORE_PASSWORD'))}}
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs): return None
def apple():
 required=['ASC_KEY_ID','ASC_ISSUER_ID','ASC_PRIVATE_KEY']
 if any(not os.getenv(k) for k in required):return {'accessible':False,'reason':'missing Apple API configuration'}
 import jwt
 token=jwt.encode({'iss':os.environ['ASC_ISSUER_ID'],'iat':int(time.time()),'exp':int(time.time())+600,'aud':'appstoreconnect-v1'},os.environ['ASC_PRIVATE_KEY'],algorithm='ES256',headers={'kid':os.environ['ASC_KEY_ID'],'typ':'JWT'})
 def rows(url):
  result=[]
  for _ in range(50):
   if urllib.parse.urlparse(url).scheme!='https' or urllib.parse.urlparse(url).netloc!='api.appstoreconnect.apple.com':raise ValueError('Invalid Apple pagination')
   req=urllib.request.Request(url,headers={'Authorization':'Bearer '+token,'Accept':'application/json'})
   with urllib.request.build_opener(NoRedirect).open(req,timeout=30) as r:data=json.load(r)
   result.extend(data['data']);url=data.get('links',{}).get('next')
   if not url:return result
  raise ValueError('Apple pagination limit')
 apps=rows('https://api.appstoreconnect.apple.com/v1/apps?filter%5BbundleId%5D=ro.nitido.app&limit=2')
 if len(apps)!=1 or apps[0]['id']!='6810752486':raise ValueError('Existing Apple identity mismatch')
 versions=rows('https://api.appstoreconnect.apple.com/v1/apps/6810752486/appStoreVersions?filter%5Bplatform%5D=IOS&limit=50')
 builds=rows('https://api.appstoreconnect.apple.com/v1/builds?filter%5Bapp%5D=6810752486&limit=200')
 if any(not b['attributes']['version'].isdigit() for b in builds):raise ValueError('Non-integer build requires review')
 return {'accessible':True,'appleAppId':'6810752486','highestBuild':max((int(b['attributes']['version']) for b in builds),default=0),'versions':[{'id':v['id'],'version':v['attributes']['versionString'],'state':v['attributes']['appStoreState']} for v in versions],'builds':[{'id':b['id'],'number':b['attributes']['version'],'processing':b['attributes'].get('processingState')} for b in builds[:10]]}
def play():
 raw=os.getenv('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON')
 if not raw:return {'accessible':False,'reason':'missing GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'}
 from google.oauth2 import service_account
 from google.auth.transport.requests import AuthorizedSession
 info=json.loads(raw);credentials=service_account.Credentials.from_service_account_info(info,scopes=['https://www.googleapis.com/auth/androidpublisher']);session=AuthorizedSession(credentials);base='https://androidpublisher.googleapis.com/androidpublisher/v3/applications/ro.nitido.app/edits';edit=None
 try:
  r=session.post(base,json={},timeout=30)
  if r.status_code!=200:return {'accessible':False,'httpStatus':r.status_code,'reason':'exact package access rejected'}
  edit=r.json()['id'];result={'accessible':True,'highestBuild':0,'tracks':[]}
  for resource in ['tracks','bundles','apks']:
   r=session.get(base+'/'+edit+'/'+resource,timeout=30)
   if r.status_code!=200:raise ValueError('Play resource unavailable '+str(r.status_code))
   data=r.json()
   if resource=='tracks':
    for track in data.get('tracks',[]):
     releases=[{'versions':v.get('versionCodes',[]),'status':v.get('status')} for v in track.get('releases',[])];result['tracks'].append({'track':track['track'],'releases':releases})
     for release in releases:
      for code in release['versions']:result['highestBuild']=max(result['highestBuild'],int(code))
   else:
    for artifact in data.get(resource,[]):result['highestBuild']=max(result['highestBuild'],int(artifact['versionCode']))
  return result
 finally:
  if edit is not None:
   r=session.delete(base+'/'+edit,timeout=30)
   if r.status_code not in [200,204]:raise ValueError('Temporary Play edit cleanup failed')
for name,fn in [('apple',apple),('googlePlay',play)]:
 try:report[name]=fn()
 except urllib.error.HTTPError as e:report[name]={'accessible':False,'httpStatus':e.code,'reason':'authenticated API request rejected'}
 except Exception as e:report[name]={'accessible':False,'reason':'Store inspection failed','errorType':type(e).__name__}
OUT.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
