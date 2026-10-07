import React, {useEffect,useRef} from 'react';
import {riffle} from './vendor/hairline.js';
export function HairlineMotion(){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!root.current)return;let figure:ReturnType<typeof riffle>|undefined;const show=()=>{if(document.hidden){figure?.destroy();figure=undefined}else if(!figure&&root.current){figure=riffle(root.current,{intensity:0.25,theme:'light',label:'A tray of cards. Hover or use arrow keys to pull one card.'})}};show();document.addEventListener('visibilitychange',show);return()=>{document.removeEventListener('visibilitychange',show);figure?.destroy()}},[]);
 return <section className="hairline-motion"><h2>A new mark takes its place.</h2><div ref={root} className="hairline-figure"/><p>Actual Hairline by Lucas Marques. Move across or use arrow keys.</p></section>;
}
