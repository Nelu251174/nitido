// Original NITIDO web alert. iOS has its independently prepared SMS resource.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sampleRate=44100, duration=1.75;
const notes=[[0,880],[.26,1174.66],[.52,1567.98],[.94,880],[1.2,1174.66],[1.46,1567.98]];
const samples=new Float64Array(Math.ceil(sampleRate*duration));
for(const [offset,frequency] of notes){
 for(let n=0;n<Math.ceil(.23*sampleRate);n++){
  const t=n/sampleRate;
  const envelope=t<.012?t/.012:t<.17?1:Math.max(0,(.23-t)/.06);
  let tone=0;
  // Band-limited triangle avoids sharp edges and high-frequency aliasing.
  for(let h=1;h<=15&&h*frequency<sampleRate/2;h+=2){
   tone+=(-1)**((h-1)/2)*Math.sin(2*Math.PI*frequency*h*t)/(h*h);
  }
  samples[Math.round(offset*sampleRate)+n]=envelope*tone*8/(Math.PI*Math.PI);
 }
}
const peak=samples.reduce((p,v)=>Math.max(p,Math.abs(v)),0);
const bytes=Buffer.alloc(44+samples.length*2);
bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);
bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);
bytes.writeUInt32LE(sampleRate,24);bytes.writeUInt32LE(sampleRate*2,28);
bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);
bytes.writeUInt32LE(samples.length*2,40);
for(let n=0;n<samples.length;n++)bytes.writeInt16LE(Math.round(samples[n]/peak*.95*32767),44+n*2);
for(const target of ['public/sounds/nitido_alert_v2.wav']){
 const file=path.join(root,target);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);
 console.log(target);
}
