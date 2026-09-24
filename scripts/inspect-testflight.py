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

# Native dependencies and code match build 11, which declares exempt encryption.
baseline=get("builds/363793a9-b821-46b4-b1a0-2ca8354d9f22")["data"]
assert baseline["attributes"]["usesNonExemptEncryption"] is False
target=get("builds/2705303f-c68c-4ad1-abb3-8c28fb9bf736")["data"]
assert target["attributes"]["version"]=="12"
payload={"data":{"type":"builds","id":target["id"],"attributes":{"usesNonExemptEncryption":False}}}
req=urllib.request.Request("https://api.appstoreconnect.apple.com/v1/builds/"+target["id"],data=json.dumps(payload).encode(),method="PATCH",headers={"Authorization":"Bearer "+token,"Content-Type":"application/json"})
with urllib.request.urlopen(req) as response: print("Encryption metadata updated:",response.status)
print(json.dumps(get("builds/"+target["id"]+"/buildBetaDetail")["data"]))
