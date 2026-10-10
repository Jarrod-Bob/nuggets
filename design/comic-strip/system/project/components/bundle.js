/* @ds-bundle: {"format":4,"namespace":"Comic","components":[{"name":"Panel"},{"name":"Strip"},{"name":"Pill"},{"name":"Chip"},{"name":"SearchField"},{"name":"StatusPill"},{"name":"NuggetCard"},{"name":"NuggetMark"},{"name":"SpeechBubble"},{"name":"Sfx"},{"name":"Burst"},{"name":"CaptionBox"},{"name":"Dialog"},{"name":"Field"},{"name":"NameSuggestions"},{"name":"SuggestedTags"},{"name":"ThoughtBubble"},{"name":"StatePill"},{"name":"ActionError"},{"name":"EmptyState"},{"name":"BinCard"},{"name":"Bin"},{"name":"LookPicker"},{"name":"SettingsSection"},{"name":"PlanWithClaude"},{"name":"RandomNugget"},{"name":"FeatureRequests"}]} */
(function () {
  var React = window.React, h = React.createElement;
  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }
  function omit(o, keys) { var r = {}; for (var k in o) if (keys.indexOf(k) < 0) r[k] = o[k]; return r; }

  /* Eight hand-tuned card outlines, drawn in viewBox "-8 -4 372 272". */
  var SHAPES = ["M334.6 130C335.7 143.5 346.7 159.2 341.4 171.3C336.1 183.3 315.1 191.7 302.5 202.2C289.9 212.7 281.3 227.1 265.7 234.2C250.1 241.4 228.3 242.2 208.9 245.3C189.5 248.3 167.2 255.7 149.3 252.5C131.3 249.2 117.2 233.8 101.3 225.7C85.4 217.7 65.2 214 54 204.3C42.7 194.5 43 179.7 34 167.3C25 154.9 0.3 142.5 0 130C-0.4 117.5 24.3 105.3 31.9 92.1C39.6 79 34.9 61.3 45.9 51C56.9 40.6 80.2 35.9 97.8 29.9C115.3 24 132.9 16.8 151.2 15.3C169.5 13.7 188 19.5 207.4 20.9C226.8 22.2 252.6 16.6 267.8 23.1C283 29.7 287.5 48.9 298.6 60.1C309.7 71.3 328.4 78.9 334.4 90.5C340.4 102.2 333.4 116.5 334.6 130Z","M334.6 130C334.9 143.4 342.2 157.6 338.4 170.5C334.5 183.4 322.9 196 311.5 207.5C300 219 287.3 234.4 269.9 239.4C252.5 244.4 227.2 235.4 207 237.7C186.9 240 167.8 254 149 253.4C130.3 252.7 111.8 241.2 94.7 233.8C77.5 226.4 57.9 219.5 46.2 208.9C34.5 198.2 32.4 182.9 24.4 169.8C16.4 156.6 -1.8 143.2 -1.7 130C-1.6 116.8 17.7 103.9 24.9 90.4C32.2 76.8 28.9 57.8 41.7 48.5C54.5 39.2 83.5 41.1 101.4 34.4C119.4 27.8 131.4 12.5 149.5 8.5C167.6 4.5 191.3 6.8 210 10.4C228.8 14 246.2 22.6 261.9 30.3C277.7 38 292.3 46.5 304.7 56.5C317.1 66.4 331.4 77.8 336.4 90C341.4 102.3 334.2 116.6 334.6 130Z","M334.6 130C336.4 144 353 160.3 349.4 173.3C345.7 186.3 326.6 198.1 312.5 208.1C298.4 218.1 282.3 227.5 264.9 233.3C247.6 239.2 227.5 240.7 208.4 243.2C189.3 245.7 168.6 250.6 150.3 248.2C132.1 245.7 116.8 234.8 99 228.5C81.3 222.2 56.8 219.9 43.9 210.2C31 200.5 26.5 183.9 21.5 170.5C16.5 157.2 12.2 143 14.1 130C15.9 117 25.9 104.7 32.5 92.3C39 79.9 42 65.1 53.5 55.5C65.1 45.9 85.4 41.3 101.7 34.8C118.1 28.3 133.7 19.9 151.5 16.7C169.4 13.4 189.8 13.9 208.8 15.4C227.8 17 249.4 19.2 265.5 25.9C281.7 32.7 293.5 45.4 305.6 56C317.7 66.6 333.3 77.2 338.2 89.6C343 101.9 332.7 116 334.6 130Z","M334.6 130C335.6 143.9 351.1 160.2 346.4 172.5C341.6 184.9 318.8 193.3 306 204.3C293.1 215.2 285.2 230.9 269.2 238.5C253.2 246 229.9 247.8 210 249.6C190.2 251.4 168 253.3 150.1 249.1C132.2 244.9 118.9 231.5 102.5 224.3C86.1 217.1 63.5 215.1 51.6 205.7C39.6 196.3 37.3 180.8 30.8 168.1C24.2 155.5 13.2 142.9 12.3 130C11.4 117.1 19.3 103.3 25.5 90.5C31.6 77.7 37.7 63.6 49.3 53C61 42.4 78.6 34.2 95.3 27C112.1 19.8 131.1 11.3 149.9 9.9C168.6 8.6 187.9 17.1 207.9 18.9C227.9 20.7 252.4 15.3 269.7 20.8C287 26.4 299.9 41 311.7 52.4C323.4 63.8 336.4 76.1 340.2 89C344 102 333.5 116.1 334.6 130Z","M334.6 130C333.2 143.5 340.2 157.7 334.4 169.5C328.6 181.2 310.3 188.6 299.8 200.6C289.4 212.6 287 234.4 271.8 241.6C256.5 248.8 228.8 242.8 208.6 243.9C188.3 245 169.4 249.8 150.3 248.3C131.2 246.7 111 241.4 94 234.7C76.9 227.9 59.4 218.6 48.2 207.7C36.9 196.8 31.9 182.2 26.5 169.2C21.1 156.3 15.7 143 15.9 130C16 117 22.6 104.3 27.3 91C32 77.6 32.5 60.4 44 49.8C55.4 39.2 77.9 33.3 95.8 27.5C113.6 21.8 132.5 16.5 151.2 15.2C169.8 13.8 188.8 17.6 207.8 19.4C226.7 21.3 247.5 21.2 265 26.5C282.6 31.9 300 41.4 312.9 51.7C325.9 62 339.2 75.3 342.8 88.4C346.4 101.4 336 116.5 334.6 130Z","M334.6 130C333.9 143.8 344.7 158.4 340.3 171C336 183.6 320.5 194.8 308.4 205.7C296.3 216.6 284 229.4 267.6 236.6C251.1 243.7 229.4 246 209.7 248.4C190.1 250.8 168.1 254.3 149.6 250.9C131.2 247.5 115.7 235.7 99.3 228.2C82.9 220.7 62.9 215.8 51.4 205.8C40 195.8 37.5 180.9 30.4 168.2C23.3 155.6 8.9 142.7 8.9 130C8.9 117.3 25.1 105.4 30.4 91.8C35.8 78.1 30.6 59.4 41 48.1C51.3 36.7 74.5 30 92.7 23.7C110.8 17.5 130.5 12.3 150 10.4C169.5 8.4 189.9 9.9 209.6 12C229.3 14.1 251.6 15.8 268 22.9C284.5 29.9 295.8 43.4 308.5 54.3C321.2 65.1 339.9 75.4 344.3 88C348.6 100.6 335.2 116.2 334.6 130Z","M334.6 130C335.5 144.4 355.5 161.1 351.3 173.8C347.1 186.5 324.2 196.8 309.4 206.3C294.7 215.7 279.6 224.9 262.6 230.5C245.6 236.1 226.2 237.4 207.6 240C189 242.5 169.9 246.5 150.9 245.7C131.9 244.9 110.6 241.5 93.6 235.1C76.6 228.7 60.2 218.1 49.2 207.1C38.2 196.1 35 181.8 27.5 169C20.1 156.1 5.9 143.4 4.5 130C3.1 116.6 11 101.3 19 88.8C27.1 76.4 40.5 65.8 52.8 55C65.1 44.2 77 32.5 92.9 24.1C108.9 15.7 129.3 5.8 148.5 4.6C167.8 3.4 187.9 14.7 208.4 17C228.9 19.3 254.8 12.4 271.6 18.5C288.4 24.7 296.9 42.3 309.3 53.8C321.7 65.3 341.8 74.9 346 87.6C350.2 100.3 333.7 115.6 334.6 130Z","M334.6 130C334.6 144.3 353.6 161 348.3 173C343 185.1 316.5 192 302.9 202.5C289.4 212.9 282.5 228.3 266.8 235.6C251.2 243 228.6 244.5 209.2 246.4C189.9 248.2 169.4 249.2 150.7 246.6C132 244.1 115.3 236.7 97 230.9C78.8 225.1 54.6 221.6 41.4 211.7C28.2 201.8 24.3 185.1 17.9 171.4C11.4 157.8 0.6 143.3 2.8 130C5 116.7 23.3 104.8 31 91.9C38.6 79 37.7 63.1 48.6 52.6C59.5 42 79.7 35.4 96.6 28.6C113.6 21.8 131.8 13.1 150.3 11.8C168.8 10.4 188.3 18.2 207.5 20.5C226.7 22.8 250.3 19.2 265.7 25.7C281.2 32.2 286.2 49.1 300 59.3C313.7 69.5 342.3 75.3 348.1 87C353.8 98.8 334.5 115.7 334.6 130Z"];

  /* A lumpy closed blob: seeded so the same seed always draws the same nugget. */
  function rng(s) { s = (Math.abs(s | 0) % 2147483646) + 1; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function blob(cx0, cy0, rx, ry, seed, n, j) {
    n = n || 16; j = j || 0.09; var r = rng(seed), pts = [], i;
    for (i = 0; i < n; i++) { var a = i / n * Math.PI * 2, k = 1 + (r() - 0.5) * 2 * j + (i % 2 ? 0.035 : -0.02); pts.push([cx0 + Math.cos(a) * rx * k, cy0 + Math.sin(a) * ry * k]); }
    var f = function (v) { return Math.round(v * 10) / 10; }, d = 'M' + f(pts[0][0]) + ' ' + f(pts[0][1]);
    for (i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += 'C' + f(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + f(p1[1] + (p2[1] - p0[1]) / 6) + ' ' + f(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + f(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + f(p2[0]) + ' ' + f(p2[1]);
    }
    return d + 'Z';
  }
  function crumbs(cx0, cy0, rx, ry, seed, count) {
    var r = rng(seed + 7), s = '';
    for (var i = 0; i < count; i++) { var a = r() * Math.PI * 2, dd = Math.sqrt(r()) * 0.62, x = cx0 + Math.cos(a) * rx * dd, y = cy0 + Math.sin(a) * ry * dd, t = r() * Math.PI, l = 3 + r() * 4; s += 'M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'l' + (Math.cos(t) * l).toFixed(1) + ' ' + (Math.sin(t) * l).toFixed(1); }
    return s;
  }

  var STATUS_FILL = { raw: 'var(--raw)', exploring: 'var(--nugget)', building: 'var(--nugget)', parked: 'var(--mayo)', killed: 'var(--burnt)', done: 'var(--pickle)' };
  var CARD_BOX = '-8 -4 372 272';
  function cardShape(n) { return SHAPES[(n || 0) % SHAPES.length]; }
  /* A nugget's id as a number for picking its shape and tilt, so it looks the same on every visit. */
  function idSeed(id, fallback) { var n = Math.abs(Number(id)); return isNaN(n) ? fallback : n; }
  function tagLine(tags) { return (tags || []).map(function (t) { return '#' + String(t).toLowerCase(); }).join(' '); }
  /* A card's drawing: the outline repeated in ink as its shadow, the status fill, the shine and the crumbs. */
  function cardArt(d, s) {
    return [
      h('path', { key: 'shadow', d: d, fill: 'var(--ink)', transform: 'translate(7 8)' }),
      h('path', { key: 'fill', className: 'cs-card-fill', d: d, fill: STATUS_FILL[s], stroke: 'var(--ink)', strokeWidth: 3.5, strokeLinejoin: 'round', strokeDasharray: s === 'parked' ? '10 8' : null }),
      h('path', { key: 'shine', d: 'M38 96C46 64 74 44 112 36M126 33h8', stroke: 'var(--paper)', strokeWidth: 7, strokeLinecap: 'round', fill: 'none' }),
      h('path', { key: 'crumbs', d: 'M300 110l4 6M292 180l6 2M70 186l-3 6M250 222l5 2M318 140l2 6', stroke: 'var(--nugget-deep)', strokeWidth: 3, strokeLinecap: 'round' })
    ];
  }

  function Panel(p) {
    var tone = p.tone || 'paper', El = p.as || 'div';
    return h(El, Object.assign(omit(p, ['tone', 'as', 'className', 'children', 'padded']), { className: cx('cs-panel', 'cs-panel--' + tone, p.padded === false ? null : 'cs-panel--padded', p.className) }), p.children);
  }

  function Strip(p) {
    return h('header', Object.assign(omit(p, ['className', 'children', 'wordmark']), { className: cx('cs-panel', 'cs-strip', p.className) }),
      p.wordmark === false ? null : h('span', { className: 'cs-wordmark' }, 'nuggets.'), p.children);
  }

  /* A pill is a button, or a link when it has an href (a deep link must be a real href). */
  function Pill(p) {
    var v = p.variant || 'paper', size = p.size && p.size !== 'md' ? 'cs-pill--' + p.size : null;
    return h(p.href ? 'a' : 'button', Object.assign(p.href ? {} : { type: 'button' }, omit(p, ['variant', 'size', 'icon', 'iconAfter', 'className', 'children']), { className: cx('cs-pill', 'cs-pill--' + v, size, p.className) }),
      p.icon ? h(Icon, { name: p.icon }) : null, p.children, p.iconAfter ? h(Icon, { name: p.iconAfter }) : null);
  }

  var ICONS = { search: [['circle', { cx: 11, cy: 11, r: 7 }], ['path', { d: 'm20 20-3.5-3.5' }]], 'arrow-right': [['path', { d: 'M5 12h14M13 6l6 6-6 6' }]], 'arrow-left': [['path', { d: 'M19 12H5M11 6l-6 6 6 6' }]], plus: [['path', { d: 'M12 5v14M5 12h14' }]],
    close: [['path', { d: 'M6 6l12 12M18 6 6 18' }]], check: [['path', { d: 'M5 12.5l4.5 4.5L19 7' }]],
    pencil: [['path', { d: 'M4 20l4.5-1L19 8.5 15.5 5 5 15.5z' }], ['path', { d: 'M13.5 7l3.5 3.5' }]],
    dice: [['rect', { x: 3.5, y: 3.5, width: 17, height: 17, rx: 4 }], ['circle', { cx: 8.5, cy: 8.5, r: 0.4 }], ['circle', { cx: 12, cy: 12, r: 0.4 }], ['circle', { cx: 15.5, cy: 15.5, r: 0.4 }]] };
  function Icon(p) {
    var parts = ICONS[p.name] || [];
    return h('svg', { className: 'cs-icon', width: p.size || 18, height: p.size || 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      parts.map(function (x, i) { return h(x[0], Object.assign({ key: i }, x[1])); }));
  }

  function Chip(p) {
    return h('button', Object.assign({ type: 'button' }, omit(p, ['pressed', 'className', 'children']), { 'aria-pressed': !!p.pressed, className: cx('cs-chip', p.className) }), p.children);
  }

  function SearchField(p) {
    return h('label', { className: cx('cs-search', p.className) }, h(Icon, { name: 'search' }),
      h('input', Object.assign({ type: 'search', 'aria-label': p.label || p.placeholder }, omit(p, ['className', 'label']))));
  }

  function StatusPill(p) {
    var s = p.status || 'raw';
    return h('span', { className: cx('cs-status', 'cs-status--' + s, p.className) }, s);
  }

  /* A curry drip: a stem open at the top (so it merges with the sauce above it), a round tip, a gloss line and an optional hanging drop. */
  function drip(x, y0, len, w, drop, key) {
    var b = y0 + len;
    return h('g', { key: key },
      h('path', { d: 'M' + (x - w) + ' ' + y0 + 'V' + b + 'A' + w + ' ' + w + ' 0 0 0 ' + (x + w) + ' ' + b + 'V' + y0 + 'Z', fill: 'var(--curry)' }),
      h('path', { d: 'M' + (x - w) + ' ' + (y0 + 6) + 'V' + b + 'A' + w + ' ' + w + ' 0 0 0 ' + (x + w) + ' ' + b + 'V' + (y0 + 6), stroke: 'var(--ink)', strokeWidth: 3, strokeLinecap: 'round', fill: 'none' }),
      h('path', { d: 'M' + (x - w / 2.4) + ' ' + (b - 4) + 'v-' + Math.max(4, Math.round(len * 0.35)), stroke: 'var(--curry-gloss)', strokeWidth: 2.5, strokeLinecap: 'round' }),
      drop ? h('ellipse', { cx: x, cy: b + w + drop, rx: w * 0.7, ry: w * 0.95, fill: 'var(--curry)', stroke: 'var(--ink)', strokeWidth: 3 }) : null);
  }
  var DAB = blob(350, 12, 128, 104, 11, 22, 0.07), FLOOD = blob(250, 90, 420, 320, 37, 30, 0.04);
  var useId = React.useId || function () { var r = React.useRef(null); if (!r.current) r.current = 'cs' + Math.random().toString(36).slice(2, 8); return r.current; };

  /* Named nuggets wear a dab of curry on their top-right corner. The dab is its own button: a mouse hovering it
     previews the sauce flooding the card to show the project name; a click, tap or Enter pins it; a second press
     or Escape drains it. Clicks anywhere else, the flood included, still open the nugget. */
  function NuggetCard(p) {
    var d = cardShape(p.shape), s = p.status || 'raw', tilt = p.tilt == null ? 0 : p.tilt, name = p.projectName;
    var tags = tagLine(p.tags);
    var clip = 'cs-clip-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
    var hv = React.useState(false), pin = React.useState(!!p.sauceOpen);
    var open = !!name && (hv[0] || pin[0]);
    React.useEffect(function () {
      if (!pin[0]) return;
      function onKey(e) { if (e.key === 'Escape') pin[1](false); }
      document.addEventListener('keydown', onKey);
      return function () { document.removeEventListener('keydown', onKey); };
    }, [pin[0]]);
    return h('div', { className: cx('cs-card', 'cs-card--' + s, name ? 'cs-card--named' : null, open ? 'cs-card--sauced' : null, p.className), style: Object.assign({ '--cs-tilt': tilt + 'deg' }, p.style) },
      h('svg', { viewBox: CARD_BOX, 'aria-hidden': true },
        h('defs', null, h('clipPath', { id: clip }, h('path', { d: d }))),
        cardArt(d, s),
        name ? h('g', { className: 'cs-curry-dab' },
          h('g', { clipPath: 'url(#' + clip + ')' }, h('path', { d: DAB, fill: 'var(--curry)', stroke: 'var(--ink)', strokeWidth: 3.5 }), h('path', { d: 'M282 34c14-8 34-8 48 2', stroke: 'var(--curry-gloss)', strokeWidth: 5, strokeLinecap: 'round', fill: 'none' })),
          h('path', { d: d, stroke: 'var(--ink)', strokeWidth: 3.5, strokeLinejoin: 'round', fill: 'none', strokeDasharray: s === 'parked' ? '10 8' : null }),
          drip(262, 60, 62, 9, 7, 'a'), drip(318, 70, 62, 7, 0, 'b')) : null),
      h('button', Object.assign({ type: 'button' }, omit(p, ['title', 'status', 'age', 'tags', 'shape', 'tilt', 'className', 'style', 'projectName', 'sauceOpen']), { className: 'cs-card-open' }),
        h('span', { className: 'cs-card-body' },
          h('span', { className: 'cs-card-meta' }, name ? h('b', null, s + (p.age ? ' · ' + p.age : '')) : h(React.Fragment, null, h('b', null, s), h('span', null, p.age || ''))),
          h('span', { className: 'cs-card-title' }, p.title),
          tags ? h('span', { className: 'cs-card-tags' }, tags) : null)),
      name ? h('svg', { className: 'cs-curry-flood', viewBox: CARD_BOX, 'aria-hidden': true },
        h('g', { clipPath: 'url(#' + clip + ')' }, h('path', { d: FLOOD, fill: 'var(--curry)' }), h('path', { d: 'M120 52c40-18 100-20 150-6M60 150c10-20 24-32 40-38', stroke: 'var(--curry-gloss)', strokeWidth: 5, strokeLinecap: 'round', fill: 'none' })),
        h('path', { d: d, stroke: 'var(--ink)', strokeWidth: 3.5, strokeLinejoin: 'round', fill: 'none' }),
        h('g', { className: 'cs-curry-drips' }, drip(150, 228, 34, 9, 8, 'a'), drip(209, 226, 20, 8, 0, 'b'), drip(266, 216, 44, 10, 0, 'c'))) : null,
      name ? h('span', { className: 'cs-curry-name', 'aria-hidden': true },
        h('span', { className: 'cs-curry-label' }, 'Project name'),
        h('span', { className: cx('cs-curry-text', name.length > 14 ? 'cs-curry-text--long' : null) }, name),
        h('span', { className: 'cs-curry-title' }, p.title)) : null,
      name ? h('button', {
        type: 'button', className: 'cs-curry-btn', 'aria-label': 'Project name: ' + name, 'aria-pressed': pin[0], title: 'Project name',
        onPointerEnter: function (e) { if (e.pointerType === 'mouse') hv[1](true); },
        onPointerLeave: function () { hv[1](false); },
        onClick: function (e) { e.stopPropagation(); pin[1](!pin[0]); if (pin[0]) hv[1](false); }
      }) : null);
  }

  function NuggetMark(p) {
    var size = p.size || 120, seed = p.seed == null ? 19 : p.seed, w = 124, hh = 104, d = blob(60, 50, 52, 40, seed, 16, 0.09);
    return h('svg', { className: cx('cs-nugget', p.className), width: size, height: size * hh / w, viewBox: '0 0 ' + w + ' ' + hh, fill: 'none', role: p.label ? 'img' : null, 'aria-label': p.label || null, 'aria-hidden': p.label ? null : true },
      h('path', { d: d, fill: 'var(--ink)', transform: 'translate(5 7)' }),
      h('path', { d: d, fill: STATUS_FILL[p.status || 'building'], stroke: 'var(--ink)', strokeWidth: 4, strokeLinejoin: 'round' }),
      h('path', { d: 'M27.8 48.5C30.8 31.1 49 25 63 25.8', stroke: 'var(--paper)', strokeWidth: 6, strokeLinecap: 'round' }),
      h('path', { d: crumbs(64, 55, 52, 40, seed, 5), stroke: 'var(--nugget-deep)', strokeWidth: 3, strokeLinecap: 'round' }));
  }

  function SpeechBubble(p) {
    return h('div', Object.assign(omit(p, ['tail', 'className', 'children', 'editing']), { className: cx('cs-bubble', 'cs-bubble--' + (p.tail || 'left'), p.editing ? 'cs-bubble--editing' : null, p.className) }), p.children);
  }

  function Sfx(p) {
    var El = p.as || 'span';
    return h(El, { className: cx('cs-sfx', 'cs-sfx--' + (p.size || 'md'), 'cs-sfx--' + (p.tone || 'nugget'), p.className), style: Object.assign({ transform: 'rotate(' + (p.tilt == null ? -6 : p.tilt) + 'deg)' }, p.style), 'aria-hidden': p.decorative === false ? null : true }, p.children);
  }

  function Burst(p) {
    var n = p.rays || 44, R = 1600, cx0 = 410, cy0 = 380, d = '';
    for (var i = 0; i < n; i += 2) { var a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; d += 'M' + cx0 + ' ' + cy0 + 'L' + (cx0 + Math.cos(a0) * R).toFixed(1) + ' ' + (cy0 + Math.sin(a0) * R).toFixed(1) + 'L' + (cx0 + Math.cos(a1) * R).toFixed(1) + ' ' + (cy0 + Math.sin(a1) * R).toFixed(1) + 'Z'; }
    return h('div', Object.assign(omit(p, ['rays', 'className', 'children']), { className: cx('cs-burst', p.className) }),
      h('svg', { className: 'cs-burst-rays', viewBox: '0 0 820 760', preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': true }, h('rect', { width: 820, height: 760, fill: 'var(--mayo)' }), h('path', { d: d, fill: 'var(--paper)' })),
      p.children);
  }

  /* A narration box: the strip's yellow caption, for notices that are about the page rather than in it.
     tone "error" swaps the fill for paper and the ink line for red ink (tomato). */
  function CaptionBox(p) {
    return h('div', Object.assign(omit(p, ['tone', 'eyebrow', 'className', 'children']), { className: cx('cs-caption', 'cs-caption--' + (p.tone || 'nugget'), p.className) }),
      p.eyebrow ? h('span', { className: 'cs-caption-eyebrow' }, p.eyebrow) : null,
      h('div', { className: 'cs-caption-text' }, p.children));
  }

  /* A dialog panel that sits on the page like a sticker. Presentational: the host owns the overlay, focus trap and Escape. */
  function Dialog(p) {
    var id = 'cs-dlg-' + useId().replace(/[^a-zA-Z0-9_-]/g, ''), descId = p.description ? id + '-desc' : null;
    return h('section', Object.assign({ role: 'dialog', 'aria-modal': true, 'aria-labelledby': id, 'aria-describedby': descId }, omit(p, ['title', 'description', 'onClose', 'footer', 'className', 'children', 'width', 'style']), { className: cx('cs-panel', 'cs-dialog', p.className), style: Object.assign({ width: p.width || 560 }, p.style) }),
      h('header', { className: 'cs-dialog-head' }, h('h2', { id: id, className: 'cs-dialog-title' }, p.title),
        p.onClose ? h('button', { type: 'button', className: 'cs-round', 'aria-label': 'Close', onClick: p.onClose }, h(Icon, { name: 'close', size: 16 })) : null),
      p.description ? h('p', { id: descId, className: 'cs-dialog-desc' }, p.description) : null,
      h('div', { className: 'cs-dialog-body' }, p.children),
      p.footer ? h('footer', { className: 'cs-dialog-foot' }, p.footer) : null);
  }

  /* A labelled text input or textarea, with a hint line under it. */
  function Field(p) {
    var auto = 'cs-f-' + useId().replace(/[^a-zA-Z0-9_-]/g, ''), id = p.id || auto, hintId = p.hint ? id + '-hint' : null;
    var input = h(p.multiline ? 'textarea' : 'input', Object.assign({ id: id, 'aria-describedby': hintId }, omit(p, ['label', 'hint', 'multiline', 'className', 'style', 'id', 'action']), { className: 'cs-field-input' }));
    return h('div', { className: cx('cs-field', p.className), style: p.style },
      h('label', { className: 'cs-field-label', htmlFor: id }, p.label),
      p.action ? h('div', { className: 'cs-field-row' }, input, p.action) : input,
      p.hint ? h('p', { id: hintId, className: 'cs-field-hint' }, p.hint) : null);
  }

  var STICKER_TILT = [-4, 3, -2, 4, -3, 2];
  /* The project-name generator: the name field, a dice pill that asks kimi for names (and re-rolls them),
     the names as tilted stickers, and why the pointed-at (or picked) name was suggested. */
  function NameSuggestions(p) {
    var names = p.names || [], state = p.state || 'idle', pt = React.useState(null);
    var rolling = state === 'rolling', blocked = p.notesEmpty || p.available === false;
    var hint = p.notesEmpty ? 'Write some notes and kimi will name it' : p.available === false ? 'kimi is not available at the moment' : null;
    var why = names.filter(function (n) { return n.name === (pt[0] || p.value); })[0];
    var dice = rolling
      ? h(Pill, { className: 'cs-dice-pill cs-dice-pill--rolling', icon: 'dice', onClick: p.onCancel, 'aria-label': 'Stop rolling names' }, 'Stop')
      : h(Pill, { className: 'cs-dice-pill', icon: 'dice', disabled: blocked, onClick: function () { p.onRoll && p.onRoll(names.length ? 'reroll' : 'roll'); }, title: 'Uses kimi-no-name-wa to suggest names from your notes' }, names.length ? 'Re-roll' : 'Roll names');
    return h('div', { className: cx('cs-names', p.className) },
      h(Field, { label: 'Suggested project name', placeholder: 'What would you call it?', value: p.value || '', onChange: function (e) { p.onChange && p.onChange(e.target.value); }, hint: hint, action: dice }),
      state === 'failed' ? h('p', { role: 'status', className: 'cs-field-hint' }, 'kimi is not available at the moment') : null,
      names.length ? h('ul', { role: 'listbox', 'aria-label': 'Names from kimi', className: 'cs-stickers' }, names.map(function (n, i) {
        var picked = n.name === p.value;
        function pick() { p.onPick && p.onPick(n.name); }
        return h('li', {
          key: n.name, role: 'option', 'aria-selected': picked, tabIndex: 0, className: cx('cs-sticker', picked ? 'cs-sticker--picked' : null), style: { '--cs-tilt': STICKER_TILT[i % STICKER_TILT.length] + 'deg' },
          onClick: pick, onKeyDown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } },
          onMouseEnter: function () { pt[1](n.name); }, onMouseLeave: function () { pt[1](null); }, onFocus: function () { pt[1](n.name); }, onBlur: function () { pt[1](null); }
        }, picked ? h(Icon, { name: 'check', size: 14 }) : null, n.name);
      })) : null,
      names.length ? h('p', { className: 'cs-names-why', 'aria-live': 'polite' }, why ? why.explanation : '') : null);
  }

  /* A thought bubble: a reason or aside, with puffs trailing back to what it is about. */
  function ThoughtBubble(p) {
    return h('span', Object.assign(omit(p, ['side', 'className', 'children', 'open']), { className: cx('cs-thought', 'cs-thought--' + (p.side || 'right'), p.open === false ? null : 'cs-thought--open', p.className) }),
      h('span', { className: 'cs-thought-puff cs-thought-puff--1', 'aria-hidden': true }), h('span', { className: 'cs-thought-puff cs-thought-puff--2', 'aria-hidden': true }),
      h('span', { className: 'cs-thought-body' }, p.children));
  }

  var REASON_DELAY_MS = 250;
  /* Tag suggestions, pencilled in: a dashed tray labelled "suggested" at the end of the tag row. Clicking a tag inks
     it in (adds it); its × rubs it out (dismisses it). Why it was suggested shows in a ThoughtBubble on hover or focus. */
  function SuggestedTags(p) {
    var list = p.suggestions || [];
    if (!list.length) return null;
    return h('span', { role: 'group', 'aria-label': 'Suggested tags', className: cx('cs-suggest', p.className) },
      h('span', { className: 'cs-suggest-label' }, h(Icon, { name: 'pencil', size: 14 }), 'suggested'),
      list.map(function (s) { return h(SuggestedTag, { key: s.tag, s: s, onAdd: p.onAdd, onDismiss: p.onDismiss, busy: p.busy === s.tag, forceOpen: p.openTag === s.tag }); }));
  }
  function SuggestedTag(p) {
    var tag = p.s.tag, ex = p.s.examples || [], rid = 'cs-r-' + useId().replace(/[^a-zA-Z0-9_-]/g, ''), ref = React.useRef(null);
    var hv = React.useState(false), fc = React.useState(false), op = React.useState(false), sd = React.useState('right');
    var engaged = hv[0] || fc[0];
    React.useEffect(function () {
      if (!engaged) { op[1](false); return; }
      var t = setTimeout(function () {
        var left = ref.current ? ref.current.getBoundingClientRect().left : 0, w = Math.min(300, window.innerWidth * 0.78);
        sd[1](left + w > document.documentElement.clientWidth - 16 ? 'left' : 'right'); op[1](true);
      }, REASON_DELAY_MS);
      return function () { clearTimeout(t); };
    }, [engaged]);
    React.useEffect(function () {
      if (!op[0]) return;
      function onKey(e) { if (e.key === 'Escape') op[1](false); }
      document.addEventListener('keydown', onKey);
      return function () { document.removeEventListener('keydown', onKey); };
    }, [op[0]]);
    var open = op[0] || p.forceOpen;
    return h('span', {
      ref: ref, className: cx('cs-stag', p.busy ? 'cs-stag--busy' : null),
      onMouseEnter: function () { hv[1](true); }, onMouseLeave: function () { hv[1](false); },
      onFocus: function () { fc[1](true); }, onBlur: function (e) { if (!e.currentTarget.contains(e.relatedTarget)) fc[1](false); }
    },
      h('button', { type: 'button', className: 'cs-stag-add', 'aria-disabled': p.busy || null, 'aria-label': 'Add the suggested tag ' + tag, 'aria-describedby': rid, onClick: function () { if (!p.busy && p.onAdd) p.onAdd(tag); } },
        h('span', { className: 'cs-stag-plus', 'aria-hidden': true }, h(Icon, { name: 'plus', size: 11 })), '#' + tag),
      h('button', { type: 'button', className: 'cs-stag-x', 'aria-disabled': p.busy || null, 'aria-label': 'Dismiss the suggested tag ' + tag, onClick: function () { if (!p.busy && p.onDismiss) p.onDismiss(tag); } }, h(Icon, { name: 'close', size: 12 })),
      h(ThoughtBubble, { id: rid, role: 'tooltip', side: sd[0], open: !!open, className: 'cs-stag-reason' },
        ex.length
          ? h(React.Fragment, null, 'Suggested because it reads like ' + (ex.length === 1 ? 'this nugget' : 'these nuggets') + ' tagged ', h('b', null, '#' + tag), ':',
            h('ul', null, ex.map(function (t) { return h('li', { key: t }, t); })))
          : h(React.Fragment, null, 'Suggested from nuggets already tagged ', h('b', null, '#' + tag), '.'),
        h('span', { className: 'cs-thought-foot' }, 'click to ink it in · × to rub it out')));
  }

  /* The state of a connection or a queued job, as a word on a fill. StatusPill is for a nugget's status; this is for everything else. */
  function StatePill(p) {
    return h('span', { className: cx('cs-state', 'cs-state--' + (p.tone || 'off'), p.className) }, p.children);
  }

  /* A failed action, said plainly: a caption box with a red-ink line. Renders nothing without a message. */
  function ActionError(p) {
    if (!p.message) return null;
    return h(CaptionBox, { tone: 'error', role: 'alert', className: cx('cs-error', p.className) },
      h('span', { className: 'cs-error-text' }, p.message),
      p.onDismiss ? h(Pill, { size: 'sm', onClick: p.onDismiss }, 'Dismiss') : null);
  }

  /* Nothing to show, in the narrator's voice: a caption box holding the headline, a line of help and at most one action. */
  function EmptyState(p) {
    return h(CaptionBox, { eyebrow: p.eyebrow || 'Meanwhile…', tone: p.tone, className: cx('cs-empty', p.className), style: p.style },
      h('h3', { className: 'cs-empty-title' }, p.headline),
      p.body ? h('p', { className: 'cs-empty-body' }, p.body) : null,
      p.action ? h('div', { className: 'cs-empty-action' }, p.action) : null);
  }

  /* A binned nugget: its card greyed and tipped further over, with Restore and Purge under it. It does not open. */
  function BinCard(p) {
    var tags = tagLine(p.tags);
    return h('li', { className: cx('cs-bin-card', p.className), style: Object.assign({ '--cs-tilt': (p.tilt == null ? -6 : p.tilt) + 'deg' }, p.style) },
      h('div', { className: 'cs-bin-shape' },
        h('svg', { viewBox: CARD_BOX, 'aria-hidden': true }, cardArt(cardShape(p.shape), 'raw')),
        h('div', { className: 'cs-card-body' },
          h('span', { className: 'cs-card-meta' }, h('b', null, 'binned'), h('span', null, p.archivedAt || '')),
          h('h3', { className: 'cs-card-title' }, p.title),
          tags ? h('span', { className: 'cs-card-tags' }, tags) : null)),
      h('div', { className: 'cs-bin-actions' },
        h(Pill, { size: 'sm', onClick: p.onRestore }, 'Restore'),
        h(Pill, { size: 'sm', variant: 'danger', onClick: p.onPurge }, 'Purge')));
  }

  var BIN_TILT = [-7, 5, -5, 8, -8, 6];
  /* The bin (Trash): binned nuggets, newest first, as greyed cards; a "Meanwhile…" caption when there are none. */
  function Bin(p) {
    var ideas = p.ideas || [];
    if (!ideas.length) return h(EmptyState, { eyebrow: 'Meanwhile, in the bin…', headline: 'Trash is empty', body: 'Archived nuggets land here. Nothing has been binned yet.', className: p.className, style: p.style });
    return h('div', { className: cx('cs-bin', p.className), style: p.style },
      h(CaptionBox, { tone: 'mayo', eyebrow: 'Meanwhile, in the bin…' }, 'Archived nuggets, newest binned first. Restoring puts one back in the bank; purging is permanent.'),
      h('ul', { className: 'cs-bin-grid' }, ideas.map(function (i, n) {
        var seed = idSeed(i.id, n);
        return h(BinCard, {
          key: i.id, title: i.title, tags: i.tags, archivedAt: i.archivedAt,
          shape: seed, tilt: BIN_TILT[seed % BIN_TILT.length],
          onRestore: function () { p.onRestore && p.onRestore(i.id); }, onPurge: function () { p.onPurge && p.onPurge(i.id); }
        });
      })));
  }

  /* The classic look in miniature: a plain card in a thin grey line. */
  function ClassicThumb() {
    return h('svg', { width: 72, height: 54, viewBox: '0 0 72 54', fill: 'none', 'aria-hidden': true },
      h('rect', { x: 2, y: 4, width: 68, height: 46, rx: 9, fill: 'var(--paper)', stroke: 'var(--ink-soft)', strokeWidth: 1.5 }),
      h('path', { d: 'M12 18h34M12 27h46M12 36h22', stroke: 'var(--ink-soft)', strokeWidth: 2.5, strokeLinecap: 'round' }));
  }
  var LOOKS = [{ value: 'classic', name: 'Classic', tilt: -3 }, { value: 'comic', name: 'Comic', tilt: 3 }];
  /* The Look picker at the top of Settings: Classic and Comic as two sticker tiles in a radio group. */
  function LookPicker(p) {
    var id = 'cs-look-' + useId().replace(/[^a-zA-Z0-9_-]/g, ''), noteId = id + '-wip';
    return h('fieldset', { className: cx('cs-look', p.className) },
      h('legend', { className: 'cs-look-legend' }, 'Look'),
      h('div', { className: 'cs-look-tiles' }, LOOKS.map(function (l) {
        var on = p.value === l.value, wip = l.value === 'comic' && p.comicInProgress;
        return h('label', { key: l.value, className: cx('cs-look-tile', on ? 'cs-look-tile--on' : null), style: { '--cs-tilt': l.tilt + 'deg' } },
          h('input', { type: 'radio', name: id, value: l.value, checked: on, className: 'cs-look-radio', 'aria-describedby': wip ? noteId : null, onChange: function () { p.onChange && p.onChange(l.value); } }),
          h('span', { className: 'cs-look-art' }, l.value === 'classic' ? h(ClassicThumb) : h(NuggetMark, { size: 64, seed: 19 })),
          h('span', { className: 'cs-look-name' }, on ? h(Icon, { name: 'check', size: 16 }) : null, l.name),
          wip ? h('span', { id: noteId, className: 'cs-look-note' }, 'In progress') : null);
      })),
      p.hint ? h('p', { className: 'cs-field-hint' }, p.hint) : null);
  }

  /* One integration in the Settings dialog: a caption-box heading, its status line, a literal error, its Fields and its pills. */
  function SettingsSection(p) {
    var id = 'cs-set-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
    return h('section', { 'aria-labelledby': id, className: cx('cs-settings', p.className) },
      h(CaptionBox, { tone: 'mayo', className: 'cs-settings-head' },
        h('h3', { id: id, className: 'cs-settings-title' }, p.title),
        p.description ? h('p', { className: 'cs-settings-desc' }, p.description) : null),
      p.status || p.detail ? h('div', { className: 'cs-settings-status' }, p.status, p.detail ? h('span', { className: 'cs-settings-detail' }, p.detail) : null) : null,
      h(ActionError, { message: p.error }),
      p.children,
      p.actions || p.dangerAction ? h('div', { className: 'cs-settings-actions' }, p.dangerAction || h('span'), h('div', { className: 'cs-settings-actions-end' }, p.actions)) : null);
  }

  /* Plan with Claude: the planning prompt in a speech bubble, the ways to send it, and a field to bring the answer back. */
  function PlanWithClaude(p) {
    var answer = p.answer || '';
    return h(Dialog, {
      title: 'Plan with Claude', width: 640, onClose: p.onClose, className: p.className,
      description: 'A planning prompt built from this nugget. Send it to Claude, then paste the answer back to keep it in the notes.',
      footer: h(Pill, { onClick: p.onClose }, 'Close')
    },
      h(SpeechBubble, { tail: 'bottom', className: 'cs-plan-bubble' }, h('pre', { className: 'cs-plan-prompt', 'aria-label': 'Planning prompt', tabIndex: 0 }, p.prompt)),
      h('div', { className: 'cs-plan-send' },
        h('div', { className: 'cs-plan-pills' },
          h(Pill, { href: p.desktopUrl, variant: 'tomato', size: 'sm' }, 'Open in Claude Desktop'),
          h(Pill, { size: 'sm', onClick: p.onCopyAndOpen }, 'Copy & open claude.ai'),
          h(Pill, { size: 'sm', onClick: p.onCopy }, 'Copy prompt')),
        p.trimmed ? h('p', { role: 'status', className: 'cs-plan-note' }, 'These notes are long, so the Claude Desktop link carries a trimmed copy of them. Copy prompt always copies the complete prompt.') : null,
        h('p', { className: 'cs-plan-note' }, 'Claude Desktop opens with the prompt filled in, ready for you to send. No desktop app? Copy & open claude.ai, then paste.'),
        p.copyNote ? h('p', { role: 'status', className: 'cs-plan-note' }, p.copyNote) : null),
      h(Field, { multiline: true, label: "Claude's answer", placeholder: "Paste Claude's plan here", rows: 6, value: answer, onChange: function (e) { p.onAnswerChange && p.onAnswerChange(e.target.value); }, hint: "Saving appends it to the end of this nugget's notes; nothing already there is replaced." }),
      h(ActionError, { message: p.saveError }),
      h('div', { className: 'cs-plan-save' }, h(Pill, { size: 'sm', onClick: p.onSave, disabled: p.saving || !answer.trim() }, 'Save to notes')));
  }

  /* The drawn nugget: its card dropped onto the dialog at a tilt, with a PICK ME stamp. Keyed by the nugget so a reroll drops a fresh one. */
  var DRAW_TILT = [-5, 4, -3, 5];
  function DrawnCard(p) {
    var i = p.idea, seed = idSeed(i.id, 0), tags = tagLine(i.tags);
    return h('div', { className: 'cs-drawn', style: { '--cs-tilt': DRAW_TILT[seed % DRAW_TILT.length] + 'deg' } },
      h('svg', { viewBox: CARD_BOX, 'aria-hidden': true }, cardArt(cardShape(seed), i.status || 'building')),
      h('div', { className: 'cs-card-body' },
        p.tag ? h('span', { className: 'cs-card-meta' }, h('b', null, 'narrowed to ' + p.tag)) : null,
        h('h3', { className: 'cs-card-title' }, i.title),
        tags ? h('span', { className: 'cs-card-tags' }, tags) : null),
      h('span', { className: 'cs-stamp', 'aria-hidden': true }, 'PICK ME'));
  }
  function ChallengeRow(p) {
    return h('div', { className: 'cs-challenge-row' },
      h('div', { className: 'cs-challenge-text' }, h('span', { className: 'cs-challenge-label' }, p.label), h('span', { className: 'cs-challenge-value' }, p.children)),
      h(Pill, { size: 'sm', onClick: p.onReroll }, p.rerollLabel));
  }
  /* Draw a nugget's result: the drawn card with its stamp, its notes, and the dealt timebox and stack, each rerolled on its own. */
  function RandomNugget(p) {
    var i = p.idea, title = p.loading ? 'Drawing…' : i ? 'Your challenge' : 'Nothing to draw';
    return h(Dialog, {
      title: title, width: 480, onClose: p.onClose, className: cx('cs-random', p.className),
      footer: [h(Pill, { key: 'c', onClick: p.onClose }, 'Close'), h(Pill, { key: 'r', variant: 'tomato', onClick: p.onReroll, disabled: p.loading }, 'Reroll nugget')]
    },
      p.loading ? h('p', { role: 'status', className: 'cs-random-wait' }, 'Drawing a nugget…')
        : !i ? h(CaptionBox, { eyebrow: 'Meanwhile, on the tray…' }, 'No active nuggets match that tag. Drop one in first.')
          : h(React.Fragment, null,
            h(DrawnCard, { key: i.id == null ? i.title : i.id, idea: i, tag: p.tag }),
            i.notes ? h('p', { className: 'cs-random-notes' }, i.notes) : null,
            p.timebox && p.stack ? h('div', { className: 'cs-challenge' },
              h(ChallengeRow, { label: 'Timebox', rerollLabel: 'Reroll timebox', onReroll: p.onRerollTimebox }, p.timebox),
              h(ChallengeRow, { label: 'Build it with', rerollLabel: 'Reroll stack', onReroll: p.onRerollStack }, p.stack.language + ' + ' + p.stack.framework, p.stack.track ? h('span', { className: 'cs-challenge-track' }, p.stack.track) : null),
              p.source ? h('a', { className: 'cs-challenge-source', href: p.source.url, target: '_blank', rel: 'noreferrer', title: p.source.retrieved ? 'Popularity weights copied ' + p.source.retrieved : null }, 'data: ' + p.source.label) : null) : null));
  }

  var REQUEST_STATE = { created: { tone: 'ok', word: 'Sent' }, pending: { tone: 'wait', word: 'Queued' }, failed: { tone: 'error', word: 'Failed' } };
  function requestView(state) { return state === 'created' || state === 'failed' ? state : 'pending'; }
  /* A nugget's GitHub feature requests as a strip of small panels: the issue (or why there isn't one yet), its repo, its state and Retry. */
  function FeatureRequests(p) {
    var list = p.requests || [];
    if (!list.length) return null;
    return h('ul', { 'aria-label': 'Feature requests', className: cx('cs-requests', p.className) }, list.map(function (r) {
      var view = requestView(r.state), state = REQUEST_STATE[view];
      var head = view === 'created'
        ? (r.url ? h('a', { href: r.url, target: '_blank', rel: 'noreferrer' }, 'Feature request #' + r.number) : h('strong', null, 'Feature request #' + r.number))
        : h('span', null, view === 'pending' ? 'Feature request queued' : 'Feature request failed');
      return h('li', { key: r.id, className: cx('cs-panel', 'cs-request', 'cs-request--' + view) },
        h('div', { className: 'cs-request-head' }, h('span', { className: 'cs-request-title' }, head), h(StatePill, { tone: state.tone }, state.word)),
        h('span', { className: 'cs-request-repo' }, r.repo),
        view !== 'created' && r.last_error ? h('p', { className: 'cs-request-error' }, r.last_error) : null,
        view === 'failed' ? h(Pill, { size: 'sm', className: 'cs-request-retry', onClick: function () { p.onRetry && p.onRetry(r.id); }, disabled: p.retrying === r.id }, 'Retry') : null);
    }));
  }

  window.Comic = Object.assign(window.Comic || {}, { Panel: Panel, Strip: Strip, Pill: Pill, Chip: Chip, SearchField: SearchField, StatusPill: StatusPill, NuggetCard: NuggetCard, NuggetMark: NuggetMark, SpeechBubble: SpeechBubble, Sfx: Sfx, Burst: Burst, CaptionBox: CaptionBox, Dialog: Dialog, Field: Field, NameSuggestions: NameSuggestions, SuggestedTags: SuggestedTags, ThoughtBubble: ThoughtBubble, StatePill: StatePill, ActionError: ActionError, EmptyState: EmptyState, BinCard: BinCard, Bin: Bin, LookPicker: LookPicker, SettingsSection: SettingsSection, PlanWithClaude: PlanWithClaude, RandomNugget: RandomNugget, FeatureRequests: FeatureRequests, Icon: Icon, nuggetPath: blob });
})();
