export async function archiveAuth(request, secret) {
  if (!secret || request.method !== 'POST' || request.headers.get('Origin') !== new URL(request.url).origin || !request.headers.get('Content-Type')?.startsWith('application/json')) return null;
  if (+request.headers.get('Content-Length') > 8000) return null;
  let text = '', bytes=0; const decoder=new TextDecoder(); const reader=request.body?.getReader(); if(!reader)return null;
  while(true){const{done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>8000){await reader.cancel();return null;}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
  let b;try{b=JSON.parse(text);}catch{return null;}
  if(!b||typeof b!=='object'||Array.isArray(b)||typeof b.password!=='string'||b.password.length>512)return null;
  const hash=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
  const [a,c]=await Promise.all([hash(b.password),hash(secret)]);let diff=0;for(let i=0;i<32;i++)diff|=a[i]^c[i];if(diff)return null;
  const {password,...body}=b;return body;
}
export async function digest(value) {return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),x=>x.toString(16).padStart(2,'0')).join('');}
export async function archiveRate(storage) {
 return storage.transaction(async tx=>{const now=Date.now();const g=await tx.get('archive-rate-global');const a=g&&now-g.at<60000?g:{at:now,n:0};if(a.n>=30)return false;a.n++;await tx.put('archive-rate-global',a);return true;});
}
export async function exportBatch(storage) {
 return storage.transaction(async tx => {
  const manifests=await tx.list({prefix:'export:',limit:101});let active=0;
  for(const [key,m] of manifests){if(Date.now()-m.createdAt>86400000)await tx.delete(key);else active++;}
  if(active>=100||manifests.size>100)throw Error('Too many pending export batches. Finish or wait for older batches to expire.');
  const canvas=await tx.get('canvas'); const current=new Set((canvas?.strokes||[]).map(s=>s.id));
  // Bounded scan and payload. Cursor is returned when earlier pages contained current entries.
  const records=await tx.list({prefix:'history:',limit:150});
  const batch=[];let bytes=0;for(const [key,record] of records){if(!current.has(record.id)){const size=new TextEncoder().encode(JSON.stringify(record)).length;if(bytes+size>950000)break;bytes+=size;batch.push({key,record});if(batch.length===100)break;}}
  if(!batch.length)return {schema:'47-strokes-archive-v1',count:0,records:[],batchId:null,sha256:null};
  const output={schema:'47-strokes-archive-v1',count:batch.length,records:batch.map(x=>x.record)};
  const sha256=await digest(output),batchId=crypto.randomUUID();
  if(new TextEncoder().encode(JSON.stringify({...output,batchId,sha256})).length>1000000)throw Error('Export batch too large.');
  await tx.put('export:'+batchId,{sha256,entries:await Promise.all(batch.map(async x=>({key:x.key,id:x.record.id,hash:await digest(x.record)}))),createdAt:Date.now()});
  return {...output,batchId,sha256};
 });
}
export async function pruneBatch(storage,body) {
 if(typeof body.batchId!=='string'||!/^[0-9a-f-]{36}$/.test(body.batchId)||typeof body.sha256!=='string'||!/^[0-9a-f]{64}$/.test(body.sha256))throw Error('Select a verified batch.');
 return storage.transaction(async tx=>{
  const m=await tx.get('export:'+body.batchId);if(!m||Date.now()-m.createdAt>86400000||m.sha256!==body.sha256)throw Error('Export manifest does not match.');
  if(m.pruned)return {deleted:m.deleted,alreadyPruned:true};
  const canvas=await tx.get('canvas'),current=new Set((canvas?.strokes||[]).map(s=>s.id));
  let deleted=0,protectedCount=0;for(const e of m.entries){if(current.has(e.id)){protectedCount++;continue;}const record=await tx.get(e.key);if(!record)continue;if(await digest(record)!==e.hash)throw Error('Archived record changed; nothing deleted.');}
  for(const e of m.entries){if(current.has(e.id))continue;if(await tx.get(e.key)){await tx.delete(e.key);deleted++;}}
  await tx.put('export:'+body.batchId,{...m,pruned:true,deleted,protectedCount});
  return {deleted,protectedCount,alreadyPruned:false};
 });
}
export const archivePage = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>47 strokes archive</title><style>body{font:14px system-ui;color:#111;margin:0;background:white}main{max-width:720px;margin:60px auto;padding:24px}h1{font:36px Georgia;font-weight:normal}input,button{font:14px system-ui;padding:12px;border:1px solid #bbb;background:white;border-radius:0}input{width:100%;box-sizing:border-box}button{cursor:pointer;margin:12px 12px 12px 0}label{display:block;margin:24px 0 8px}#status{height:52px;overflow:auto;margin-top:16px}.note{color:#666;line-height:1.6}#batch{width:100%}.actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.actions button{margin:0}</style></head><body><main><h1>47 strokes archive</h1><p class="note">Private maintenance. Export older stroke history, verify the copy in Drive, then clear only that exact batch. The current 47 strokes are protected.</p><label for="password">Archive password</label><input id="password" type="password" autocomplete="current-password"><div class="actions"><button id="export">Export older strokes</button><button id="clear" disabled>Clear verified batch</button></div><label for="batch">Exported batch manifest</label><input id="batch" readonly placeholder="Export a batch first"><p class="note">Clear only after downloading the Drive copy again and verifying its full contents, count and checksum. No background deletion.</p><div id="status" role="status"></div><a href="/">Back to canvas</a></main><script>
let batch=null,busy=false;const status=document.getElementById('status'),exp=document.getElementById('export'),clear=document.getElementById('clear'),field=document.getElementById('batch');
function resetBatch(){batch=null;field.value='';clear.disabled=true;}function pending(value){busy=value;exp.disabled=value;clear.disabled=value||!batch;}
async function call(action,extra={}){const r=await fetch('/archive/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.getElementById('password').value,...extra})});const b=await r.json();if(!r.ok)throw Error(b.error||'Archive request failed.');return b;}
exp.onclick=async()=>{if(busy)return;resetBatch();pending(true);try{status.textContent='Exporting…';const exported=await call('export');if(!exported.count){status.textContent='No older strokes to export.';return;}const blob=new Blob([JSON.stringify(exported)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='47-strokes-'+exported.batchId+'.json';a.click();URL.revokeObjectURL(a.href);batch=exported;field.value=batch.batchId+' · '+batch.count+' strokes · unverified';status.textContent='Export downloaded. Verify the Drive copy before clearing.';}catch(e){resetBatch();status.textContent=e.message;}finally{pending(false);}};
clear.onclick=async()=>{if(busy||!batch)return;if(!confirm('Has the downloaded Drive copy passed content, count and checksum verification?'))return;pending(true);try{const b=await call('prune',{batchId:batch.batchId,sha256:batch.sha256});status.textContent=b.deleted+' older records cleared. Current 47 preserved.';resetBatch();}catch(e){status.textContent=e.message;}finally{pending(false);}};
</script></body></html>`;
