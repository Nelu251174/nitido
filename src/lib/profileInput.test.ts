import {it,expect} from 'vitest';
import {profileInputError} from './profileInput';
it('rejects malformed values before string processing',()=>{for(const value of [null,[],12,{name:{}},{email:12},{phone:[]},{name:'x'.repeat(151)}])expect(profileInputError(value)).not.toBeNull()});
it('accepts bounded strings for account and firm profiles',()=>{expect(profileInputError({name:'Nelu',email:'n@example.com',phone:'0722111222'})).toBeNull();expect(profileInputError({name:'Firm',coverageCity:'București',description:'Text'},true)).toBeNull()});
it('rejects oversized firm fields instead of silently truncating',()=>{for(const field of ['coverageCity','description','services','website','coverageCitiesExtra'])expect(profileInputError({[field]:'x'.repeat(2001)},true)).not.toBeNull();expect(profileInputError({coverageCity:[]},true)).not.toBeNull()});
