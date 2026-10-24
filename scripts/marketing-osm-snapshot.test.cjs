const {test}=require('node:test'),assert=require('node:assert/strict');
const {Transform}=require('node:stream');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {business,stitchRings,inBoundary,selectedRelations,prepare}=require('./marketing-osm-snapshot.cjs');
const coordinates=new Map([[1,[0,0]],[2,[10,0]],[3,[10,10]],[4,[0,10]],[5,[4,4]],[6,[6,4]],[7,[6,6]],[8,[4,6]]]);
test('joins reversed municipal boundary segments and excludes holes and outside points',()=>{
 const outer=stitchRings([[1,2,3],[1,4,3]],coordinates),inner=stitchRings([[5,6,7,8,5]],coordinates);
 assert.equal(inBoundary([2,2],outer,inner),true);assert.equal(inBoundary([5,5],outer,inner),false);assert.equal(inBoundary([12,2],outer,inner),false);assert.equal(inBoundary([0,3],outer,inner),true);
 assert.throws(()=>stitchRings([[1,2],[3,4]],coordinates),/NOT_CLOSED/);
 assert.throws(()=>stitchRings([[1,2,99,1]],coordinates),/COORDINATE_MISSING/);
});
test('propagates nested relation membership regardless of order and terminates on cycles',()=>{
 assert.deepEqual([...selectedRelations(new Set([3]),new Map([[3,new Set([2])],[2,new Set([1,3])]]))].sort(),[1,2,3]);
});
test('matches the current business sectors and never invents a named business',()=>{
 for(const tags of [{office:'cleaning'},{shop:'supermarket'},{craft:'carpenter'},{amenity:'dentist'},{tourism:'hotel'},{leisure:'fitness_centre'}])assert.equal(business({name:'Fixture',...tags}),true);
 assert.equal(business({name:'Park',leisure:'park'}),false);assert.equal(business({office:'company'}),false);
});
const boundary={type:'relation',id:100,tags:{name:'Constanța',boundary:'administrative',admin_level:'8'},members:[{type:'way',id:10,role:'outer'},{type:'way',id:11,role:'inner'}]};
function entities(){return [
 ...[...coordinates].map(([id,[lon,lat]])=>({type:'node',id,lon,lat,tags:{}})),
 {type:'node',id:20,lon:2,lat:2,tags:{name:'Inside',shop:'yes',email:'office@fixture.example',uid:'contributor-metadata'}},
 {type:'node',id:21,lon:5,lat:5,tags:{name:'Hole',shop:'yes'}},
 {type:'node',id:22,lon:12,lat:2,tags:{name:'Outside',shop:'yes'}},
 {type:'way',id:10,refs:[1,2,3,4,1],tags:{}},{type:'way',id:11,refs:[5,6,7,8,5],tags:{}},
 {type:'way',id:30,refs:[20,22],tags:{name:'Inside way',office:'company'}},boundary,
 {type:'relation',id:210,tags:{name:'Nested business',office:'company'},members:[{type:'relation',id:211,role:''}]},
 {type:'relation',id:211,tags:{},members:[{type:'way',id:30,role:''}]},
 ];}
function parser(items){return ()=>new Transform({objectMode:true,transform(_c,_e,done){done();},flush(done){this.push(items);done();}});}
test('prepares only municipal source identities and contact tags after all boundary passes',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mkt-snapshot-')),file=path.join(dir,'fixture');fs.writeFileSync(file,'fixture');
 try{const result=await prepare(file,parser(entities()),{source:'synthetic'});const envelope=JSON.parse(result.output);assert.equal(result.total,3);assert.deepEqual(envelope.payload.elements.map(e=>e.id),[3600000100,20,30,210]);assert.equal(result.output.includes('contributor-metadata'),false);assert.equal(envelope.payload.elements[1].tags.email,'office@fixture.example');}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('rejects ambiguous and incomplete boundaries instead of generating a partial inventory',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mkt-snapshot-')),file=path.join(dir,'fixture');fs.writeFileSync(file,'fixture');
 try{await assert.rejects(prepare(file,parser([...entities(),{...boundary,id:101}]),{}),/AMBIGUOUS/);await assert.rejects(prepare(file,parser(entities().filter(e=>e.id!==10)),{}),/WAY_MISSING/);}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('county preparation streams more than 100000 firms without the municipality inventory caps',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mkt-county-')),file=path.join(dir,'fixture');fs.writeFileSync(file,'fixture');
 const items=entities(),wayIndex=items.findIndex(e=>e.type==='way'),large=[...items.slice(0,wayIndex),...Array.from({length:100001},(_,i)=>({type:'node',id:i+1000,lon:2,lat:2,tags:{name:'County fixture '+i,office:'company',email:'public'+i+'@fixture.example'}})),...items.slice(wayIndex).map(e=>e.id===100?{...e,tags:{...e.tags,admin_level:'4','ISO3166-2':'RO-CT'}}:e)];
 let emitted=0;
 try{const result=await prepare(file,parser(large),{source:'synthetic'},{region:{code:'CT',iso:'RO-CT'},emit:()=>emitted++});assert.equal(emitted,100004);assert.equal(result.total,100004);assert.equal(JSON.parse(result.output).payload.elements.length,1);}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('spilled public geometry membership remains exact without retaining every ID in memory',()=>{
 const Database=require('better-sqlite3'),{SpillSet}=require('./marketing-osm-snapshot.cjs'),db=new Database(':memory:');
 try{const set=new SpillSet(db,'nodes',3);for(let i=1;i<=30;i++)set.add(4294967296+i);set.add(4294967297);assert.equal(set.size,30);for(let i=1;i<=30;i++)assert.equal(set.has(4294967296+i),true);assert.equal(set.has(4294967399),false);assert.ok(set.memory.size<3);}
 finally{db.close();}
});
