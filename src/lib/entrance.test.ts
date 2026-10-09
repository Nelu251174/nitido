import {it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {validEntrance,entranceAddressKey,JOB_NAVIGATION_SCHEMA} from './entrance';
const address={street:'Strada 1',city:'Brașov',postalCode:'500001'};
const point={lat:45.65,lng:25.6,confirmed:true,addressKey:entranceAddressKey(address)};
it('invalidates confirmed pin after changing street, city or postcode',()=>{expect(validEntrance(point,address)).toBe(true);for(const key of ['street','city','postalCode'])expect(validEntrance(point,{...address,[key]:'other'})).toBe(false);});
it.each([{lat:NaN},{lng:Infinity},{lat:91},{lng:-181},{lat:'45'},{confirmed:false},{addressKey:''}])('rejects unsafe pin %j',change=>expect(validEntrance({...point,...change},address)).toBe(false));
it('keeps destination out of SELECT jobs and rolls back with booking',()=>{const db=new Database(':memory:');db.exec('PRAGMA foreign_keys=ON; CREATE TABLE jobs(id TEXT PRIMARY KEY);');db.exec(JOB_NAVIGATION_SCHEMA);expect(()=>db.transaction(()=>{db.prepare('INSERT INTO jobs VALUES(?)').run('j');db.prepare('INSERT INTO job_navigation VALUES(?,?,?,?)').run('j',45,26,'now');throw Error('booking failed');})()).toThrow();expect(db.prepare('SELECT * FROM job_navigation').all()).toEqual([]);db.prepare('INSERT INTO jobs VALUES(?)').run('j');db.prepare('INSERT INTO job_navigation VALUES(?,?,?,?)').run('j',45,26,'now');expect(db.prepare('SELECT * FROM jobs').get()).toEqual({id:'j'});db.close();});
