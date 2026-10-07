// Private append-only artwork records. Never included in public canvas snapshots.
export async function initializeHistory(storage, fallback) {
 return storage.transaction(async tx => {
  if (await tx.get('history-enabled-v1')) return;
  const stored = await tx.get('canvas');
  const canvas = stored || fallback;
  if (!canvas) return;
  if (!stored) await tx.put('canvas', canvas);
  for (const stroke of canvas.strokes) {
    await tx.put('history:' + stroke.id, {id:stroke.id,points:stroke.points,url:stroke.url,source:(stroke.id.startsWith('intro-draw-one-line-')||stroke.id.startsWith('seed-'))?'starter':'visitor',acceptedAt:null,baseline:true});
  }
  await tx.put('history-enabled-v1',{baselineVersion:canvas.version,count:canvas.strokes.length});
 });
}
export async function archiveAccepted(tx, stroke, now, motion=null) {
 await tx.put('history:' + stroke.id,{id:stroke.id,points:stroke.points,url:stroke.url,source:'visitor',acceptedAt:now,baseline:false,motion});
}
