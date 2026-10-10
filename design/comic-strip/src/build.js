// Inlines the generated art into template.html -> ../index.html. Run: node build.js
const fs=require('fs'),p=f=>require('path').join(__dirname,f);
const strip=s=>s.replace(/ layer-name="[^"]*"/g,'');
const bucket=strip(fs.readFileSync(p('bucket.svg'),'utf8')).replace('<svg ','<svg aria-hidden="true" ');
const hero=`<svg viewBox="0 0 520 460" fill="none" aria-hidden="true">${fs.readFileSync(p('hero.svg'),'utf8')}</svg>`;
const small=`<svg viewBox="0 0 124 104" fill="none" aria-hidden="true">${JSON.parse(fs.readFileSync(p('small.json'),'utf8'))[1]}</svg>`;
const out=fs.readFileSync(p('template.html'),'utf8')
  .replace('{{BUCKET}}',bucket).replace('{{HERO}}',hero).replace('{{SMALL}}',small)
  .replaceAll('{{BURST}}',fs.readFileSync(p('burst.txt'),'utf8'))
  .replace('{{SHAPES}}',fs.readFileSync(p('cards.json'),'utf8'));
fs.writeFileSync(p('../index.html'),out);
console.log('wrote index.html',out.length);
