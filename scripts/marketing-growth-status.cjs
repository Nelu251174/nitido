// Read-only aggregate readiness. Never logs contact data, sender credentials or confirmation links.
const Database=require('better-sqlite3');
if(!['https://sandbox.nitido.ro','https://nitido.ro'].includes(process.env.NEXT_PUBLIC_SITE_URL))throw Error('ORIGIN_GUARD');
const db=new Database('/app/data/nitido.db',{readonly:true,fileMustExist:true});
try{const exists=name=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
 const campaigns=exists('marketing_campaigns')?db.prepare("SELECT state,json_extract(payload,'$.county') county,json_extract(payload,'$.category') category,json_extract(payload,'$.variant') variant,COUNT(*) count FROM marketing_campaigns GROUP BY 1,2,3,4").all():[];
 const contacts=exists('marketing_contacts')?db.prepare('SELECT category,consent,status,COUNT(*) count FROM marketing_contacts GROUP BY 1,2,3').all():[];
 const signups=exists('marketing_signups')?db.prepare('SELECT state,category,county_code county,COUNT(*) count FROM marketing_signups GROUP BY 1,2,3').all():[];
 const tokens=exists('marketing_signups')?db.prepare('SELECT COUNT(*) count FROM marketing_signups WHERE confirmation_hash IS NOT NULL').get():{count:0};
 const outbox=exists('marketing_outbox')?db.prepare('SELECT mode,status,COUNT(*) count FROM marketing_outbox GROUP BY mode,status').all():[];
 console.log('MKT_GROWTH_STATUS '+JSON.stringify({campaigns,contacts,signups,confirmationTokens:tokens.count,outbox,delivery:process.env.NITIDO_MARKETING_DELIVERY_ENABLED==='true'?'enabled':'blocked'}));
}finally{db.close();}
