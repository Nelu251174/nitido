import os,time,json,urllib.request,urllib.parse
import jwt
token=jwt.encode({"iss":os.environ["ISSUER"],"iat":int(time.time()),"exp":int(time.time())+600,"aud":"appstoreconnect-v1"},os.environ["KEY"],algorithm="ES256",headers={"kid":os.environ["KEY_ID"]})
def get(path):
 req=urllib.request.Request("https://api.appstoreconnect.apple.com/v1/"+path,headers={"Authorization":"Bearer "+token})
 with urllib.request.urlopen(req) as r:return json.load(r)
for version in ["11","12"]:
 data=get("builds?"+urllib.parse.urlencode({"filter[app]":"6810752486","filter[version]":version,"limit":10}))
 for b in data["data"]:
  print(json.dumps({"version":version,"id":b["id"],"attributes":b["attributes"]}))
  print(json.dumps(get("builds/"+b["id"]+"/buildBetaDetail")["data"]))
  print(json.dumps([{"id":g["id"],"attributes":g["attributes"]} for g in get("builds/"+b["id"]+"/betaGroups")["data"]]))
