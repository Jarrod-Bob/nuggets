// Curry-dip study art: a base card plus three curry overlay states. Run: node curry.js
const fs=require('fs'),path=require('path');
const C={paper:'#FFFFFF',ink:'#141210',nugget:'#FFB21E',deep:'#E08A00',curry:'#956A0A',gloss:'#D9A53A'};
const d=JSON.parse(fs.readFileSync(path.join(__dirname,'cards.json'),'utf8'))[0];
function rng(s){return()=>{s=(s*16807)%2147483647;return (s-1)/2147483646}}
const f=n=>Math.round(n*10)/10;
function blob(cx,cy,rx,ry,seed,n=22,j=0.07){const r=rng(seed),p=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2,k=1+(r()-.5)*2*j;p.push([cx+Math.cos(a)*rx*k,cy+Math.sin(a)*ry*k])}
 let s=`M${f(p[0][0])} ${f(p[0][1])}`;for(let i=0;i<n;i++){const a=p[(i-1+n)%n],b=p[i],c=p[(i+1)%n],e=p[(i+2)%n];s+=`C${f(b[0]+(c[0]-a[0])/6)} ${f(b[1]+(c[1]-a[1])/6)} ${f(c[0]-(e[0]-b[0])/6)} ${f(c[1]-(e[1]-b[1])/6)} ${f(c[0])} ${f(c[1])}`}return s+'Z'}
const VB='viewBox="-8 -4 372 312" width="372" height="312"';
const base=`<svg xmlns="http://www.w3.org/2000/svg" ${VB} fill="none"><path d="${d}" fill="${C.ink}" transform="translate(7 8)"/><path d="${d}" fill="${C.nugget}"/><path d="M38 96C46 64 74 44 112 36M126 33h8" stroke="${C.paper}" stroke-width="7" stroke-linecap="round"/><path d="M300 110l4 6M292 180l6 2M70 186l-3 6M250 222l5 2M318 140l2 6" stroke="${C.deep}" stroke-width="3" stroke-linecap="round"/><path d="${d}" stroke="${C.ink}" stroke-width="3.5" stroke-linejoin="round"/></svg>`;
// drip: fill shape + side/bottom stroke (open at the top so it merges with the sauce)
function drip(x,y0,len,w,drop){const b=y0+len;const shape=`M${x-w} ${y0}V${b}A${w} ${w} 0 0 0 ${x+w} ${b}V${y0}Z`;const line=`M${x-w} ${y0+6}V${b}A${w} ${w} 0 0 0 ${x+w} ${b}V${y0+6}`;
 let s=`<path d="${shape}" fill="${C.curry}"/><path d="${line}" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/><path d="M${x-w/2.4} ${b-4}v-${Math.max(4,len*0.35).toFixed(0)}" stroke="${C.gloss}" stroke-width="2.5" stroke-linecap="round"/>`;
 if(drop)s+=`<ellipse cx="${x}" cy="${b+w+drop}" rx="${w*0.7}" ry="${w*0.95}" fill="${C.curry}" stroke="${C.ink}" stroke-width="3"/>`;return s}
function overlay(name,sauce,drips,glossD){
 const s=`<svg xmlns="http://www.w3.org/2000/svg" ${VB} fill="none"><defs><clipPath id="c"><path d="${d}"/></clipPath></defs>
<g clip-path="url(#c)"><path d="${sauce}" fill="${C.curry}" stroke="${C.ink}" stroke-width="3.5"/>${glossD?`<path d="${glossD}" stroke="${C.gloss}" stroke-width="5" stroke-linecap="round"/>`:''}</g>
<path d="${d}" stroke="${C.ink}" stroke-width="3.5" stroke-linejoin="round"/>${drips}</svg>`;
 fs.writeFileSync(path.join(__dirname,'..','assets',name),s)}
fs.writeFileSync(path.join(__dirname,'..','assets','curry-card-base.svg'),base);
// 1 rest: a dab on the top-right corner with one short drip on the card face
overlay('curry-rest.svg',blob(350,12,128,104,11),drip(262,60,62,9,7)+drip(318,70,62,7,0),'M282 34c14-8 34-8 48 2');
// 2 spreading: sauce has run two-thirds across, drips forming at the right edge
overlay('curry-spread.svg',blob(330,30,250,190,23,26,0.06),drip(318,168,22,8,0)+drip(276,205,14,7,0),'M220 50c30-14 70-14 100 0');
// 3 settled: sauce covers the card, drips run off the bottom edge
overlay('curry-full.svg',blob(250,90,420,320,37,30,0.04),drip(150,240,34,9,8)+drip(209,232,20,8,0)+drip(266,220,48,10,0),'M120 52c40-18 100-20 150-6');
console.log('ok');
