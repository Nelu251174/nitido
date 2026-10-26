/** Browser-safe streaming: the 200-row limit is a request batch, never a file/territory ceiling. */
export async function* marketingCsvBatches(chunks:AsyncIterable<string>,maxRows=200,maxBytes=240000){
 const encoder=new TextEncoder();let row='',quoted=false,skipLF=false,header='',batch:string[]=[],bytes=0;
 for await(const chunk of chunks){
  for(const ch of chunk){
   if(skipLF){skipLF=false;if(ch==='\n')continue;}
   if((ch==='\n'||ch==='\r')&&!quoted){
    if(ch==='\r')skipLF=true;
    if(row.trim()){
     if(!header){header=row.replace(/^\uFEFF/,'');bytes=encoder.encode(header+'\r\n').length;}
     else{const size=encoder.encode(row+'\r\n').length;if(size+encoder.encode(header+'\r\n').length>maxBytes)throw Error('Un rând CSV depășește dimensiunea permisă per lot.');if(batch.length>=maxRows||bytes+size>maxBytes){yield header+'\r\n'+batch.join('\r\n');batch=[];bytes=encoder.encode(header+'\r\n').length;}batch.push(row);bytes+=size;}
    }row='';
   }else{row+=ch;if(ch==='"')quoted=!quoted;if(row.length>maxBytes)throw Error('Un rând CSV este prea mare.');}
  }
 }
 if(quoted)throw Error('Ghilimele CSV neînchise.');
 if(row.trim()){if(!header)throw Error('CSV trebuie să conțină antet și contacte.');const size=encoder.encode(row+'\r\n').length;if(size+encoder.encode(header+'\r\n').length>maxBytes)throw Error('Un rând CSV este prea mare.');if(batch.length>=maxRows||bytes+size>maxBytes){yield header+'\r\n'+batch.join('\r\n');batch=[];}batch.push(row);}
 if(!header||!batch.length)throw Error('CSV trebuie să conțină antet și contacte.');
 yield header+'\r\n'+batch.join('\r\n');
}
export async function* marketingFileText(file:File){
 const reader=file.stream().getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
 try{while(true){const {value,done}=await reader.read();if(done)break;yield decoder.decode(value,{stream:true});}const tail=decoder.decode();if(tail)yield tail;}finally{reader.releaseLock();}
}
