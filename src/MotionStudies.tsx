import React,{useRef,useEffect} from 'react';
// Original geometry. Continuous input uses a bounded spring, sleeps when settled.
function Figure({kind,title,detail}:{kind:number,title:string,detail:string}){
 const root=useRef<HTMLDivElement>(null),groups=useRef<(SVGGElement|null)[]>([]);
 useEffect(()=>{const el=root.current;if(!el)return;const media=matchMedia('(prefers-reduced-motion: reduce)'),values=Array.from({length:7},()=>({x:0,v:0,t:0}));let frame=0,last=0,visible=true;
 const paint=()=>groups.current.forEach((g,i)=>{if(g)g.setAttribute('transform',`translate(0 ${-values[i].x.toFixed(2)})`)});
 function tick(now:number){frame=0;const dt=Math.min(.04,(now-last)/1000||.016);last=now;let moving=false;for(const s of values){if(media.matches){s.x=s.t;s.v=0;continue;}const n=Math.ceil(dt*240),h=dt/n;for(let i=0;i<n;i++){s.v+=(-100*(s.x-s.t)-18*s.v)*h;s.x+=s.v*h;}if(Math.abs(s.x-s.t)<.01&&Math.abs(s.v)<.1){s.x=s.t;s.v=0}else moving=true;}paint();if(moving&&visible&&!document.hidden)frame=requestAnimationFrame(tick);}
 function wake(){if(!frame&&visible&&!document.hidden){last=performance.now();frame=requestAnimationFrame(tick)}}
 function choose(a:number){if(media.matches)a=-1;values.forEach((s,i)=>s.t=a<0?0:Math.max(0,1-Math.abs(i-a)/3)*(kind===1?18:kind===2?26:22));wake();}
 function move(e:PointerEvent){const r=el!.getBoundingClientRect();choose(Math.max(0,Math.min(6,(e.clientX-r.left)/r.width*7-.5)));}
 function leave(){choose(-1)}
 function change(){if(media.matches){values.forEach(s=>{s.x=0;s.t=0;s.v=0});paint()}wake()}
 function focus(){choose(3)}
 function hidden(){if(document.hidden&&frame){cancelAnimationFrame(frame);frame=0}else wake()}
 const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(!visible&&frame){cancelAnimationFrame(frame);frame=0}else wake()});observer.observe(el);
 el.addEventListener('pointermove',move);el.addEventListener('pointerleave',leave);el.addEventListener('focus',focus);el.addEventListener('blur',leave);media.addEventListener('change',change);document.addEventListener('visibilitychange',hidden);
 return()=>{cancelAnimationFrame(frame);observer.disconnect();el.removeEventListener('pointermove',move);el.removeEventListener('pointerleave',leave);el.removeEventListener('focus',focus);el.removeEventListener('blur',leave);media.removeEventListener('change',change);document.removeEventListener('visibilitychange',hidden)};
 },[kind]);
 return <div className="study" ref={root} tabIndex={0} role="img" aria-label={`${title}. ${detail} Move across or focus to lift the pieces.`}><div className="studylabel"><span>0{kind+1}</span><span>{title}</span></div><svg viewBox="0 0 320 210" aria-hidden="true"><path className="studybase" d="M38 134L140 76L281 146L180 198Z"/>{Array.from({length:7},(_,i)=>{const x=52+i*23,y=105+i*10;return <g key={i} ref={g=>{groups.current[i]=g}}>{kind===0?<><path d={`M${x} ${y}l26 -15 12 7 -26 15Z`}/><path d={`M${x} ${y}v8l12 7 26 -15v-8`}/><path className="crease" d={`M${x+3} ${y}l23 -13`}/></>:kind===1?<><path d={`M${x} ${y}l14 -8 14 7 -14 8Z`}/><path d={`M${x} ${y}v${18+(i%3)*5}l14 7 14 -8v-${18+(i%3)*5}`}/><path className="crease" d={`M${x+3} ${y}l10 -5`}/></>:<><path d={`M${x} ${y}l25 -14 12 6 -25 15Z`}/><path d={`M${x} ${y}v5l12 7 25 -15v-5`}/><path className="crease" d={`M${x+5} ${y}q6 -12 12 -5t12 -7`}/></>}</g>})}</svg><p>{detail}</p></div>
}
export function MotionStudies(){return <section className="motionsection"><div className="sectiontop"><h2>Small objects. Quiet movement.</h2><span>Move across · touch · keyboard focus</span></div><div className="studies"><Figure kind={0} title="One joins" detail="A new mark takes its place."/><Figure kind={1} title="Older, lighter" detail="The surrounding marks step back."/><Figure kind={2} title="A trace remains" detail="Your line stays exactly where you drew it."/></div><p className="motionnote">Original SVG studies, inspired by Hairline's pointer-responsive objects. Motion settles at rest and respects reduced motion.</p></section>}
