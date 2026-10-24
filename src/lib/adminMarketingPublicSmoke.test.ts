import { expect,it } from 'vitest';
import { collectBusinessWebsite } from './adminMarketingWebCollection';
it.skipIf(process.env.NITIDO_MARKETING_PUBLIC_SMOKE!=='true')('reads the public NITIDO website without sending messages',async()=>{const result=await collectBusinessWebsite('https://nitido.ro/');expect(result.name).toBeTruthy();expect(result.website).toBe('https://nitido.ro/');console.info(JSON.stringify({publicWebsite:result.website,publishedEmailsFound:result.found.length,sourcePages:[...new Set(result.found.map(row=>row.source))]}));},60000);
