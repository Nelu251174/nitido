import {it,expect} from 'vitest';
import {executionCsv,validReportMonth} from './executionCsv';
it('rejects invalid months rather than exporting every month',()=>{for(const m of ['2026-00','2026-13','2026-1','all',''])expect(validReportMonth(m)).toBe(false);expect(validReportMonth('2026-09')).toBe(true)});
it('escapes spreadsheet formulas and quoted multiline fields',()=>{const csv=executionCsv({month:'2026-09',totalJobs:1,totalAmount:123.45,rows:[{jobId:'j',completedAt:null,city:' =1+1',street:'Strada "A"\n2',sqm:80,spaceType:'birou',firmName:'@SUM(1)',priceGross:123.45}]});expect(csv).toContain('"\' =1+1"');expect(csv).toContain('"\'@SUM(1)"');expect(csv).toContain('"Strada ""A""\n2"');expect(csv).toContain('"123.45"')});
