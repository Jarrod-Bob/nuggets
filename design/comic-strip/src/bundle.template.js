/* @ds-bundle: {"format":4,"namespace":"Comic","components":[{"name":"Panel"},{"name":"Strip"},{"name":"Pill"},{"name":"Chip"},{"name":"SearchField"},{"name":"StatusPill"},{"name":"NuggetCard"},{"name":"NuggetMark"},{"name":"SpeechBubble"},{"name":"Sfx"},{"name":"Burst"},{"name":"CaptionBox"},{"name":"Dialog"},{"name":"Field"},{"name":"NameSuggestions"},{"name":"SuggestedTags"},{"name":"ThoughtBubble"}]} */
(function () {
  var React = window.React, h = React.createElement;
  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }
  function omit(o, keys) { var r = {}; for (var k in o) if (keys.indexOf(k) < 0) r[k] = o[k]; return r; }

  /* Eight hand-tuned card outlines, drawn in viewBox "-8 -4 372 272". */
  var SHAPES = __SHAPES__;

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

  function Panel(p) {
    var tone = p.tone || 'paper', El = p.as || 'div';
    return h(El, Object.assign(omit(p, ['tone', 'as', 'className', 'children', 'padded']), { className: cx('cs-panel', 'cs-panel--' + tone, p.padded === false ? null : 'cs-panel--padded', p.className) }), p.children);
  }

  function Strip(p) {
    return h('header', Object.assign(omit(p, ['className', 'children', 'wordmark']), { className: cx('cs-panel', 'cs-strip', p.className) }),
      p.wordmark === false ? null : h('span', { className: 'cs-wordmark' }, 'nuggets.'), p.children);
  }

  function Pill(p) {
    var v = p.variant || 'paper';
    return h('button', Object.assign({ type: 'button' }, omit(p, ['variant', 'size', 'icon', 'iconAfter', 'className', 'children']), { className: cx('cs-pill', 'cs-pill--' + v, p.size === 'lg' ? 'cs-pill--lg' : null, p.className) }),
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
    var d = SHAPES[(p.shape || 0) % SHAPES.length], s = p.status || 'raw', tilt = p.tilt == null ? 0 : p.tilt, name = p.projectName;
    var tags = (p.tags || []).map(function (t) { return '#' + String(t).toLowerCase(); }).join(' ');
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
      h('svg', { viewBox: '-8 -4 372 272', 'aria-hidden': true },
        h('defs', null, h('clipPath', { id: clip }, h('path', { d: d }))),
        h('path', { d: d, fill: 'var(--ink)', transform: 'translate(7 8)' }),
        h('path', { className: 'cs-card-fill', d: d, fill: STATUS_FILL[s], stroke: 'var(--ink)', strokeWidth: 3.5, strokeLinejoin: 'round', strokeDasharray: s === 'parked' ? '10 8' : null }),
        h('path', { d: 'M38 96C46 64 74 44 112 36M126 33h8', stroke: 'var(--paper)', strokeWidth: 7, strokeLinecap: 'round', fill: 'none' }),
        h('path', { d: 'M300 110l4 6M292 180l6 2M70 186l-3 6M250 222l5 2M318 140l2 6', stroke: 'var(--nugget-deep)', strokeWidth: 3, strokeLinecap: 'round' }),
        name ? h('g', { className: 'cs-curry-dab' },
          h('g', { clipPath: 'url(#' + clip + ')' }, h('path', { d: DAB, fill: 'var(--curry)', stroke: 'var(--ink)', strokeWidth: 3.5 }), h('path', { d: 'M282 34c14-8 34-8 48 2', stroke: 'var(--curry-gloss)', strokeWidth: 5, strokeLinecap: 'round', fill: 'none' })),
          h('path', { d: d, stroke: 'var(--ink)', strokeWidth: 3.5, strokeLinejoin: 'round', fill: 'none', strokeDasharray: s === 'parked' ? '10 8' : null }),
          drip(262, 60, 62, 9, 7, 'a'), drip(318, 70, 62, 7, 0, 'b')) : null),
      h('button', Object.assign({ type: 'button' }, omit(p, ['title', 'status', 'age', 'tags', 'shape', 'tilt', 'className', 'style', 'projectName', 'sauceOpen']), { className: 'cs-card-open' }),
        h('span', { className: 'cs-card-body' },
          h('span', { className: 'cs-card-meta' }, name ? h('b', null, s + (p.age ? ' · ' + p.age : '')) : h(React.Fragment, null, h('b', null, s), h('span', null, p.age || ''))),
          h('span', { className: 'cs-card-title' }, p.title),
          tags ? h('span', { className: 'cs-card-tags' }, tags) : null)),
      name ? h('svg', { className: 'cs-curry-flood', viewBox: '-8 -4 372 272', 'aria-hidden': true },
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

  /* A narration box: the strip's yellow caption, for notices that are about the page rather than in it. */
  function CaptionBox(p) {
    return h('div', Object.assign(omit(p, ['tone', 'eyebrow', 'className', 'children']), { className: cx('cs-caption', 'cs-caption--' + (p.tone || 'nugget'), p.className) }),
      p.eyebrow ? h('span', { className: 'cs-caption-eyebrow' }, p.eyebrow) : null,
      h('span', { className: 'cs-caption-text' }, p.children));
  }

  /* A dialog panel that sits on the page like a sticker. Presentational: the host owns the overlay, focus trap and Escape. */
  function Dialog(p) {
    var id = 'cs-dlg-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
    return h('section', Object.assign({ role: 'dialog', 'aria-modal': true, 'aria-labelledby': id }, omit(p, ['title', 'onClose', 'footer', 'className', 'children', 'width', 'style']), { className: cx('cs-panel', 'cs-dialog', p.className), style: Object.assign({ width: p.width || 560 }, p.style) }),
      h('header', { className: 'cs-dialog-head' }, h('h2', { id: id, className: 'cs-dialog-title' }, p.title),
        p.onClose ? h('button', { type: 'button', className: 'cs-round', 'aria-label': 'Close', onClick: p.onClose }, h(Icon, { name: 'close', size: 16 })) : null),
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

  window.Comic = Object.assign(window.Comic || {}, { Panel: Panel, Strip: Strip, Pill: Pill, Chip: Chip, SearchField: SearchField, StatusPill: StatusPill, NuggetCard: NuggetCard, NuggetMark: NuggetMark, SpeechBubble: SpeechBubble, Sfx: Sfx, Burst: Burst, CaptionBox: CaptionBox, Dialog: Dialog, Field: Field, NameSuggestions: NameSuggestions, SuggestedTags: SuggestedTags, ThoughtBubble: ThoughtBubble, Icon: Icon, nuggetPath: blob });
})();
