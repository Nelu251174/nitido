import {sign} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const APPLE_ID='6810752486',PACKAGE='ro.nitido.app';
const b64=value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('base64url');
function jwt(header,payload,key,algorithm){const value=b64(header)+'.'+b64(payload);return value+'.'+sign(algorithm,Buffer.from(value),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');}
export function readDelimited(text,delimiter){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(quoted||!field)quoted=!quoted;else throw Error('INVALID_CSV');}
  else if(c===delimiter&&!quoted){row.push(field);field='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v!==''))rows.push(row);row=[];field='';}
  else field+=c;
 }
 if(quoted)throw Error('INVALID_CSV');if(field||row.length){row.push(field);rows.push(row);}
 if(rows.length<1||rows[0].length<2)throw Error('INVALID_REPORT_SCHEMA');
 const headers=rows.shift().map(s=>s.replace(/^\uFEFF/,'').trim());if(new Set(headers).size!==headers.length)throw Error('INVALID_REPORT_SCHEMA');
 return rows.map(r=>{if(r.length!==headers.length)throw Error('INVALID_REPORT_ROW');return Object.fromEntries(headers.map((k,i)=>[k,r[i]]));});
}
function count(value){if(!/^-?\d+$/.test(value??'')||!Number.isSafeInteger(Number(value))||Math.abs(Number(value))>1e9)throw Error('INVALID_REPORT_COUNT');return Number(value);}
function country(value){if(!/^[A-Z]{2}$/.test(value??''))throw Error('INVALID_REPORT_COUNTRY');return value;}
export function parseAppleReport(text,expectedDate){
 if(!['Apple Identifier','Product Type Identifier','Country Code','Units',...(expectedDate?['Begin Date','End Date']:[])].every(h=>text.split(/\r?\n/,1)[0].replace(/^\uFEFF/,'').split('\t').includes(h)))throw Error('INVALID_REPORT_SCHEMA');
 const totals=new Map();for(const r of readDelimited(text,'\t')){
  if(expectedDate)for(const column of ['Begin Date','End Date']){
   const parts=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(r[column]??'');
   if(!parts||`${parts[3]}-${parts[1]}-${parts[2]}`!==expectedDate)throw Error('APPLE_REPORT_DATE_MISMATCH');
  }
  if(r['Apple Identifier']!==APPLE_ID)continue;
  const first=['1','1F','1T'].includes(r['Product Type Identifier']),again=['3','3F','3T'].includes(r['Product Type Identifier']);if(!first&&!again)continue;
  const code=country(r['Country Code']),n=count(r.Units);if(n<0)throw Error('NEGATIVE_APP_UNITS');
  const c=totals.get(code)??{country:code,installs:0,redownloads:0};c[first?'installs':'redownloads']+=n;totals.set(code,c);
 }
 return [...totals.values()].sort((a,b)=>a.country.localeCompare(b.country));
}
export function decodeGoogleReport(bytes){const buffer=Buffer.from(bytes);if(buffer[0]===255&&buffer[1]===254)return buffer.subarray(2).toString('utf16le');if(buffer[0]===254&&buffer[1]===255)throw Error('UNSUPPORTED_REPORT_ENCODING');return buffer.toString('utf8').replace(/^\uFEFF/,'');}
export function parseGoogleReport(text,date){
 const rows=readDelimited(text,','),header=text.split(/\r?\n/,1)[0];
 const column=header.includes('Daily Device Installs')?'Daily Device Installs':header.includes('Install events')?'Install events':null;
 if(!column||!['Date','Package Name','Country'].every(h=>header.includes(h)))throw Error('INVALID_REPORT_SCHEMA');
 const countries=[];const seen=new Set();
 for(const r of rows){if(r.Date!==date||r['Package Name']!==PACKAGE)continue;const code=country(r.Country);if(seen.has(code))throw Error('DUPLICATE_COUNTRY');seen.add(code);const n=count(r[column]);if(n<0)throw Error('INVALID_REPORT_COUNT');countries.push({country:code,installs:n});}
 return {present:countries.length>0,metric:column==='Daily Device Installs'?'device_installs':'install_events',countries:countries.sort((a,b)=>a.country.localeCompare(b.country))};
}
async function boundedFetch(url,options,request){const response=await request(url,{...options,redirect:'error',signal:AbortSignal.timeout(20000)});if(Number(response.headers.get('content-length'))>32*1024*1024)throw Error('REPORT_TOO_LARGE');return response;}
async function bytes(response){if(!response.body)throw Error('EMPTY_REPORT');const reader=response.body.getReader();const chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>32*1024*1024)throw Error('REPORT_TOO_LARGE');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}return Buffer.concat(chunks);}
const missing=(source,reportDate,reason,status='blocked')=>({source,reportDate,status,metric:source==='apple'?'app_units':'device_installs',countries:[],reason});
export async function collectApple(date,{env=process.env,request=fetch,now=Date.now()}={}){
 if(!env.APP_STORE_CONNECT_KEY_ID||!env.APP_STORE_CONNECT_ISSUER_ID||!env.APP_STORE_CONNECT_API_KEY||!env.APPLE_VENDOR_NUMBER)return missing('apple',date,'APPLE_ACCESS_NOT_CONFIGURED');
 try{
  if(!/^\d{6,12}$/.test(env.APPLE_VENDOR_NUMBER))throw Error('INVALID_VENDOR_NUMBER');
  const seconds=Math.floor(now/1000),token=jwt({alg:'ES256',kid:env.APP_STORE_CONNECT_KEY_ID,typ:'JWT'},{iss:env.APP_STORE_CONNECT_ISSUER_ID,iat:seconds,exp:seconds+600,aud:'appstoreconnect-v1'},env.APP_STORE_CONNECT_API_KEY.replace(/\\n/g,'\n'),'sha256');
  const headers={Authorization:'Bearer '+token};
  const ownership=await boundedFetch('https://api.appstoreconnect.apple.com/v1/apps/'+APPLE_ID,{headers},request);
  if(!ownership.ok)return missing('apple',date,'APPLE_ACCESS_HTTP_'+ownership.status);
  const app=await ownership.json();if(app?.data?.attributes?.bundleId!==PACKAGE)return missing('apple',date,'APPLE_APP_MISMATCH');
  const query=new URLSearchParams({'filter[frequency]':'DAILY','filter[reportType]':'SALES','filter[reportSubType]':'SUMMARY','filter[version]':'1_0','filter[reportDate]':date,'filter[vendorNumber]':env.APPLE_VENDOR_NUMBER});
  const response=await boundedFetch('https://api.appstoreconnect.apple.com/v1/salesReports?'+query,{headers},request);
  if(!response.ok)return missing('apple',date,'APPLE_REPORT_HTTP_'+response.status,response.status===404?'pending':'blocked');
  const data=await bytes(response),decoded=data[0]===31&&data[1]===139?gunzipSync(data,{maxOutputLength:32*1024*1024}):data;
  return {source:'apple',reportDate:date,status:'ready',metric:'app_units',countries:parseAppleReport(decoded.toString('utf8'),date)};
 }catch{return missing('apple',date,'APPLE_REPORT_UNCONFIRMED');}
}
export async function googleMonthlyReport(month,{env=process.env,request=fetch,now=Date.now()}={}){
 if(!env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON||!env.GOOGLE_PLAY_REPORTS_BUCKET)return {reason:'GOOGLE_ACCESS_NOT_CONFIGURED'};
 try{
  const service=JSON.parse(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON),bucket=env.GOOGLE_PLAY_REPORTS_BUCKET;
  if(!/^pubsite_prod_rev_[a-zA-Z0-9_-]+$/.test(bucket)||typeof service.client_email!=='string'||!service.private_key)throw Error('INVALID_GOOGLE_CONFIG');
  const seconds=Math.floor(now/1000),assertion=jwt({alg:'RS256',typ:'JWT'},{iss:service.client_email,scope:'https://www.googleapis.com/auth/devstorage.read_only',aud:'https://oauth2.googleapis.com/token',iat:seconds,exp:seconds+600},service.private_key,'RSA-SHA256');
  const tokenResponse=await boundedFetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})},request);
  if(!tokenResponse.ok)return {reason:'GOOGLE_ACCESS_HTTP_'+tokenResponse.status};const token=await tokenResponse.json();if(!token.access_token)throw Error('INVALID_GOOGLE_TOKEN');
  const object=`stats/installs/installs_${PACKAGE}_${month}_country.csv`;
  const response=await boundedFetch('https://storage.googleapis.com/storage/v1/b/'+encodeURIComponent(bucket)+'/o/'+encodeURIComponent(object)+'?alt=media',{headers:{Authorization:'Bearer '+token.access_token}},request);
  if(!response.ok)return {reason:'GOOGLE_REPORT_HTTP_'+response.status,status:response.status===404?'pending':'blocked'};
  return {text:decodeGoogleReport(await bytes(response))};
 }catch{return {reason:'GOOGLE_REPORT_UNCONFIRMED'};}
}
export async function collectStoreReports({env=process.env,request=fetch,now=Date.now()}={}){
 const reports=[],months=new Map();
 for(let i=1;i<=7;i++){
  const date=new Date(Date.parse(new Date(now).toISOString().slice(0,10))-i*86400000).toISOString().slice(0,10),month=date.slice(0,7).replace('-','');
  reports.push(await collectApple(date,{env,request,now}));
  if(!months.has(month))months.set(month,await googleMonthlyReport(month,{env,request,now}));
  const google=months.get(month);
  if(!google.text){reports.push(missing('google',date,google.reason,google.status??'blocked'));continue;}
  try{const parsed=parseGoogleReport(google.text,date);reports.push(parsed.present?{source:'google',reportDate:date,status:'ready',metric:parsed.metric,countries:parsed.countries}:missing('google',date,'GOOGLE_DAY_NOT_PUBLISHED','pending'));}catch{reports.push(missing('google',date,'GOOGLE_REPORT_INVALID'));}
 }
 return {action:'reports',digestDate:new Date(now).toISOString().slice(0,10),reports};
}
