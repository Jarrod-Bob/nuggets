const fs=require('fs');
function rng(s){return()=>{s=(s*16807)%2147483647;return (s-1)/2147483646;}}
const f=n=>Math.round(n*10)/10;
// bumpy blob: centre cx,cy radii rx,ry, n bumps
function blob(cx,cy,rx,ry,seed,n=16,j=0.09){
  const r=rng(seed);const pts=[];
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2;const k=1+(r()-0.5)*2*j+(i%2?0.035:-0.02);pts.push([cx+Math.cos(a)*rx*k,cy+Math.sin(a)*ry*k]);}
  let d=`M${f(pts[0][0])} ${f(pts[0][1])}`;
  for(let i=0;i<n;i++){const p0=pts[(i-1+n)%n],p1=pts[i],p2=pts[(i+1)%n],p3=pts[(i+2)%n];
    const c1=[p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6],c2=[p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6];
    d+=`C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;}
  return d+'Z';
}
// crumb ticks inside ellipse
function crumbs(cx,cy,rx,ry,seed,count){const r=rng(seed);let s='';for(let i=0;i<count;i++){const a=r()*Math.PI*2,d=Math.sqrt(r())*0.72;const x=cx+Math.cos(a)*rx*d,y=cy+Math.sin(a)*ry*d;const t=r()*Math.PI;const l=3+r()*4;s+=`M${f(x)} ${f(y)}l${f(Math.cos(t)*l)} ${f(Math.sin(t)*l)}`;}return s;}
// a nugget group at origin-centred
function nugget(cx,cy,rx,ry,seed,sw=4){
  return `<g><path d="${blob(cx+5,cy+7,rx,ry,seed)}" fill="var(--color-ink)"/><path d="${blob(cx,cy,rx,ry,seed)}" fill="var(--color-nugget)" stroke="var(--color-ink)" stroke-width="${sw}" stroke-linejoin="round"/><path d="M${f(cx-rx*0.62)} ${f(cy-ry*0.05)}C${f(cx-rx*0.55)} ${f(cy-ry*0.55)} ${f(cx-rx*0.15)} ${f(cy-ry*0.72)} ${f(cx+rx*0.18)} ${f(cy-ry*0.7)}" stroke="var(--color-paper)" stroke-width="${f(sw*1.6)}" stroke-linecap="round"/><path d="${crumbs(cx+rx*0.08,cy+ry*0.1,rx,ry,seed+7,Math.round(rx*ry/600))}" stroke="var(--color-nugget-deep)" stroke-width="${f(sw*0.75)}" stroke-linecap="round"/></g>`;
}
// bucket
function ey(x,cx,rx,cy,ry){const u=(x-cx)/rx;return cy+ry*Math.sqrt(Math.max(0,1-u*u));}
let B='';
const CX=280;
const topY=200,trx=230,try_=46,botY=590,brx=170,bry=34;
const body=`M50 200L110 590A170 34 0 0 0 450 590L510 200A230 46 0 0 1 50 200Z`;
B+=`<ellipse cx="290" cy="${botY+22}" rx="230" ry="26" fill="var(--color-toast)"/>`;
B+=`<ellipse cx="${CX}" cy="${topY}" rx="${trx}" ry="${try_}" fill="var(--color-ink)"/>`;
B+=`<path d="M${CX-230} ${topY}A230 46 0 0 1 ${CX+230} ${topY}" stroke="var(--color-ink)" stroke-width="5" fill="none"/>`;
// pile
const pile=[[150,170,72,54,11],[262,128,80,60,23],[380,160,74,56,37],[205,205,70,50,41],[330,200,76,54,53]];
B+=pile.map(p=>nugget(...p,4.5)).join('');
B+=`<path d="${body}" fill="var(--color-paper)"/>`;
// stripes
const N=9;for(let i=1;i<N;i+=2){const t0=i/N,t1=(i+1)/N;const pts=[];
  const seg=8;for(let k=0;k<=seg;k++){const t=t0+(t1-t0)*k/seg;const x=50+460*t;pts.push([x,ey(x,CX,trx,topY,try_)]);}
  for(let k=seg;k>=0;k--){const t=t0+(t1-t0)*k/seg;const x=110+340*t;pts.push([x,ey(x,CX,brx,botY,bry)]);}
  B+=`<path d="M${pts.map(p=>f(p[0])+' '+f(p[1])).join('L')}Z" fill="var(--color-tomato)"/>`;}
// halftone on right side
let dots='';for(let y=topY+50;y<botY+20;y+=11){const tt=(y-topY)/(botY-topY);const L=50+60*tt,R=510-60*tt;const yb=y;
  for(let x=R-8;x>R-(R-L)*0.34;x-=11){const fr=(x-(R-(R-L)*0.34))/((R-L)*0.34);const yl=ey(x,CX,trx,topY,try_);const yl2=ey(x,CX,brx,botY,bry);if(yb<yl+6||yb>yl2-6)continue;const off=((y/11)%2)?5.5:0;dots+=`<circle cx="${f(x-off)}" cy="${f(y)}" r="${f(0.6+fr*2.6)}"/>`;}}
B+=`<g fill="var(--color-ink)" opacity="0.32">${dots}</g>`;
B+=`<path d="${body}" stroke="var(--color-ink)" stroke-width="5" stroke-linejoin="round"/>`;
// front rim band
B+=`<path d="M48 200A232 48 0 0 0 512 200L512 214A232 50 0 0 1 48 214Z" fill="var(--color-paper)" stroke="var(--color-ink)" stroke-width="5" stroke-linejoin="round"/>`;
// label panel
B+=`<path d="M170 360L392 352L400 470L176 480Z" fill="var(--color-mayo)" stroke="var(--color-ink)" stroke-width="5" stroke-linejoin="round"/>`;
// shine
B+=`<path d="M86 260L116 470" stroke="var(--color-paper)" stroke-width="9" stroke-linecap="round" opacity=".9"/>`;
const bucket=`<svg layer-name="Bucket" width="560" height="640" viewBox="0 0 560 640" fill="none">${B}</svg>`;
fs.writeFileSync('bucket.svg',bucket);
// burst
function burst(w,h,cx,cy,n){let s='';const R=Math.hypot(w,h);for(let i=0;i<n;i+=2){const a0=i/n*Math.PI*2,a1=(i+1)/n*Math.PI*2;s+=`M${cx} ${cy}L${f(cx+Math.cos(a0)*R)} ${f(cy+Math.sin(a0)*R)}L${f(cx+Math.cos(a1)*R)} ${f(cy+Math.sin(a1)*R)}Z`;}return s;}
fs.writeFileSync('burst.txt',burst(820,720,410,380,44));
// card blobs (wide)
const cards=[];for(const s of [3,17,29,43,61,71,83,97]) cards.push(blob(180,130,168,118,s,18,0.06));
fs.writeFileSync('cards.json',JSON.stringify(cards));
// single nugget hero
fs.writeFileSync('hero.svg',nugget(260,230,210,165,19,7));
fs.writeFileSync('small.json',JSON.stringify([nugget(60,50,52,40,5,4),nugget(60,50,52,40,13,4),nugget(60,50,52,40,31,4)]));
console.log(bucket.length, fs.readFileSync('burst.txt','utf8').length);
