// Builds ../system/project/components/bundle.js from bundle.template.js and the card outlines in cards.json.
// Run: node make-bundle.js
const fs = require('fs'), path = require('path');
const shapes = fs.readFileSync(path.join(__dirname, 'cards.json'), 'utf8').trim();
const tpl = fs.readFileSync(path.join(__dirname, 'bundle.template.js'), 'utf8');
const out = path.join(__dirname, '..', 'system', 'project', 'components', 'bundle.js');
fs.writeFileSync(out, tpl.replace('__SHAPES__', shapes));
console.log('wrote', path.relative(process.cwd(), out));
