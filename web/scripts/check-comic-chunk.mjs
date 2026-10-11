// Run after `npm run build`. Asserts that Classic never downloads the Comic
// look: the entry bundle (what index.html loads) holds no Comic fonts, tokens
// or shell, and a separate Comic chunk holds them all (ADR 0002, #51).
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../internal/web/dist');
const assets = path.join(dist, 'assets');
const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
const entryFiles = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
check(entryFiles.length > 0, 'index.html references no JS/CSS entry files');

const comicFiles = readdirSync(assets).filter((f) => /^ComicShell-.*\.(js|css)$/.test(f));
check(comicFiles.some((f) => f.endsWith('.js')), 'no separate Comic JS chunk (ComicShell-*.js) was built');
check(comicFiles.some((f) => f.endsWith('.css')), 'no separate Comic CSS chunk (ComicShell-*.css) was built');

// What only the Comic chunk may contain.
const FONTS = ['Bricolage Grotesque', 'Bangers', 'Instrument Sans', 'Space Mono'];
// Class names and copy from the Comic views (#52): the tray, its cards, the curry corner, the dialog.
const VIEW_MARKERS = ['comic-tray', 'comic-card', 'comic-curry', 'comic-dialog', 'comic-pill', 'PICK ME'];
const comicOnly = [...FONTS, '--comic-', 'comic-strip', 'comic-shell', ...VIEW_MARKERS];

for (const file of entryFiles) {
  check(!/ComicShell/.test(file), `index.html loads the Comic chunk eagerly: ${file}`);
  const text = readFileSync(path.join(dist, file), 'utf8');
  for (const needle of comicOnly) {
    check(!text.includes(needle), `entry ${file} contains "${needle}"`);
  }
}
check(!/ComicShell/.test(html), 'index.html preloads the Comic chunk');

const comicText = Object.fromEntries(comicFiles.map((f) => [f, readFileSync(path.join(assets, f), 'utf8')]));
const comicCss = Object.entries(comicText).filter(([f]) => f.endsWith('.css')).map(([, t]) => t).join('\n');
const comicJs = Object.entries(comicText).filter(([f]) => f.endsWith('.js')).map(([, t]) => t).join('\n');
for (const needle of [...FONTS, '--comic-ink', 'comic-strip']) {
  check(comicCss.includes(needle), `Comic CSS chunk is missing "${needle}"`);
}
check(comicJs.includes('comic-strip'), 'Comic JS chunk is missing the shell (comic-strip)');

// The Comic views are lazy chunks of their own (not the entry's): they hold the
// markers above, and no file the entry loads does. Lazy chunks are every
// asset .js that is neither the entry nor the shell.
const entrySet = new Set(entryFiles.map((f) => path.basename(f)));
const viewJs = readdirSync(assets).filter((f) => f.endsWith('.js') && !entrySet.has(f) && !comicFiles.includes(f));
const viewText = viewJs.map((f) => readFileSync(path.join(assets, f), 'utf8')).join('\n');
for (const needle of ['comic-tray', 'comic-curry', 'comic-card', 'PICK ME']) {
  check(viewText.includes(needle), `no lazy Comic view chunk contains "${needle}" (is the Comic bank still lazy?)`);
}

if (failures.length > 0) {
  console.error('Comic chunk check FAILED:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log(`Comic chunk check passed: entry ${entryFiles.join(', ')} is Comic-free; Comic chunk ${Object.keys(comicText).join(', ')}.`);
