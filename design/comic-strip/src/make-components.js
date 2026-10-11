// Writes components/<Comp>/README.md and preview.html for the nuggets Comic Strip system.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'system', 'project', 'components');

const C = {
  Panel: {
    group: 'Layout', height: 230,
    readme: `An inked comic panel: the block every page is built from.

**Use it for** every region of a page. Separate panels with the \`gutter\` (14px) and nothing else; never nest a panel inside a panel except the tray's liner.

**Provide** the content as children, and a \`tone\`:
- \`paper\` (default) for reading panels.
- \`mayo\` for the one feature panel on a screen (the bucket, a nugget's hero). One per screen.
- \`nugget\` only for the top \`Strip\`; prefer \`Strip\` itself.
- \`tomato\` for the action panel that holds the page's primary pills. Text inside is \`on-tomato\` (ink).

Set \`padded={false}\` for illustration panels that bleed to the line. Pass \`as\` for semantics (\`section\`, \`aside\`).

**Don't** add shadows, change the 3px \`line\`, or round the corners beyond \`radius-panel\`.`,
    body: `h('div',{style:{display:'grid',gridTemplateColumns:'1.2fr 1fr',gap:14,padding:14}},
  h(C.Panel,null,h('span',{className:'label',style:{color:'var(--ink-soft)'}},'PREVIOUSLY, IN YOUR NOTES APP…'),h('div',{className:'title',style:{marginTop:10}},'Ideas, by the bucket.')),
  h('div',{style:{display:'grid',gap:14}},h(C.Panel,{tone:'mayo'},h('span',{className:'body'},'mayo: the feature panel')),h(C.Panel,{tone:'tomato'},h('span',{className:'body-strong'},'tomato: the action panel'))))`
  },
  Strip: {
    group: 'Layout', height: 110,
    readme: `The nugget-gold strip across the top of every page: the \`nuggets.\` wordmark, then that page's controls.

**Provide** the controls as children: a \`SearchField\` (it grows to fill), then \`Pill\`s, primary last. On the bucket page the children are two \`label\` captions instead.

It wraps under 700px. Make the wordmark a link back to the bucket on every page but the bucket itself. Exactly one per page, always first.`,
    body: `h('div',{style:{padding:14}},h(C.Strip,null,h(C.SearchField,{placeholder:'Rummage through the tray…',style:{flex:1}}),h(C.Pill,null,'Pick one at random'),h(C.Pill,{variant:'tomato',icon:'plus'},'Drop a nugget')))`
  },
  Pill: {
    group: 'Actions', height: 110,
    readme: `The only button shape: a 3px ink pill in \`button\` type.

**Variants:** \`paper\` (default) for everything; \`tomato\` for the one primary action on a screen ("Drop a nugget", "Drop it in"); \`ink\` for a pressed or selected state; \`danger\` for an action that cannot be undone ("Purge", "Disconnect"): paper, ink text, outlined in red ink (\`tomato\`), never filled. \`size="lg"\` (58px tall, 20px label) for the single call to action on a page, such as "Tip the bucket"; \`size="sm"\` (34px, 14px label) for pills inside a card, a caption box or a settings section.

Pass \`href\` and the pill renders as a link, for a deep link that must be a real \`href\` ("Open in Claude Desktop").

**Provide** a sentence-case verb phrase as children, and optionally \`icon\` / \`iconAfter\` (\`arrow-right\` after "Tip the bucket", \`arrow-left\` before "Back to the tray", \`plus\` before "Drop a nugget").

Hover lifts 2px up-left onto \`shadow-lift\`; press drops 1px and loses the shadow. **Don't** put sound-effect lettering on a pill, and don't put two tomato pills side by side.`,
    body: `h('div',{style:{display:'flex',gap:14,flexWrap:'wrap',alignItems:'center',padding:20}},h(C.Pill,{size:'lg',iconAfter:'arrow-right'},'Tip the bucket'),h(C.Pill,{variant:'tomato',icon:'plus'},'Drop a nugget'),h(C.Pill,{icon:'arrow-left'},'Back to the tray'),h(C.Pill,{variant:'ink'},'Selected'),h(C.Pill,{variant:'danger'},'Purge'),h(C.Pill,{size:'sm'},'Restore'),h(C.Pill,{disabled:true},'Disabled'))`
  },
  Chip: {
    group: 'Actions', height: 80,
    readme: `A tag filter toggle in bold mono, thinner-lined than a pill.

**Provide** the label (\`all\`, or a tag as \`#saas\`) and \`pressed\`. A pressed chip fills \`ink\`. Exactly one chip in a filter row is pressed; "all" comes first, then tags alphabetically. Tags are always lowercase.`,
    body: `h('div',{style:{display:'flex',gap:8,flexWrap:'wrap',padding:20}},['all','#games','#hardware','#saas','#tooling','#writing'].map((t,i)=>h(C.Chip,{key:t,pressed:i===0},t)))`
  },
  SearchField: {
    group: 'Forms', height: 90,
    readme: `The pill-shaped search input with a search icon, for the \`Strip\`.

**Provide** \`placeholder\` (in the app's voice: "Rummage through the tray…"), \`value\` and \`onChange\`; pass \`label\` if the placeholder is not a good accessible name. It takes \`flex: 1\` in the strip. Focus draws the \`focus\` ring around the whole pill.`,
    body: `h('div',{style:{padding:20}},h(C.SearchField,{placeholder:'Rummage through the tray…'}))`
  },
  StatusPill: {
    group: 'Status', height: 80,
    readme: `A nugget's status as its word on its status fill.

**Provide** \`status\`: \`raw\` (pale \`raw\`), \`exploring\` and \`building\` (\`nugget\`), \`parked\` (\`mayo\`, dashed line), \`killed\` (\`burnt\`, \`on-burnt\` text), \`done\` (\`pickle\`). The word is always shown, so colour is never the only signal. Use it at the top of a nugget's title panel; cards show status in their own meta line instead.`,
    body: `h('div',{style:{display:'flex',gap:10,flexWrap:'wrap',padding:20}},['raw','exploring','building','parked','killed','done'].map(s=>h(C.StatusPill,{key:s,status:s})))`
  },
  NuggetCard: {
    group: 'Nuggets', height: 330,
    readme: `A nugget on the tray: a lumpy outline in its status fill, with an ink shadow, a shine and crumbs, holding status, age, title and tags.

**Provide** \`title\`, \`status\`, \`age\` ("2d", "today"), \`tags\` (names without the hash) and an \`onClick\` that opens the nugget. Give each nugget a stable \`shape\` (0–7) and \`tilt\` (about −4° to 4°), derived from its id, so it looks the same on every visit.

Lay cards in a grid with \`card-gap\` columns: three across, two under 1100px, one under 700px. Keep titles under about 50 characters; they balance onto three lines at most. On hover a card lifts and flips its tilt. **Don't** put a card anywhere but the tray liner, and don't add a second shadow.

## The curry corner

Pass \`projectName\` and the nugget wears a dab of \`curry\` on its top-right corner, with two short drips down the face. One dab means named; a nugget without a project name has no sauce at all.

- **Mouse hover on the dab** previews: the sauce pours from the corner across the whole card (a \`clip-path\` circle, 2s ease-in-out, slow like something thick), then the drips run off the bottom edge and hang (500ms bounce, 1.5s in). The name appears in white \`on-curry\` display type over a \`PROJECT NAME\` caption and the title.
- **Click, tap or Enter on the dab** pins it; a second press or Escape drains it (800ms). Clicks anywhere else on the card, the sauce included, still open the nugget.
- **Screen readers** get the name from the dab's label ("Project name: Golden Hour") whether or not the sauce is showing; the flood's text is hidden from them. The dab reports its pinned state with \`aria-pressed\`.
- **Reduced motion:** no pour; the sauce fades in and out (200ms) and the drips are simply there.
- **Long names** drop from 44px to 32px past 14 characters, then wrap to two lines, then end in an ellipsis.

The dab takes the top-right corner, where an unnamed card shows its age, so a named card moves its age next to its status (\`BUILDING · 2D\`) and narrows its text to clear the drips. \`sauceOpen\` starts it pinned (for previews and screenshots).`,
    body: `h('div',{style:{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:'24px 32px',padding:'20px 24px'}},
  h(C.NuggetCard,{title:'A receipt scanner that argues back',status:'building',age:'2d',tags:['saas','writing'],shape:0,tilt:-4,projectName:'Golden Hour'}),
  h(C.NuggetCard,{title:'Commit messages as haiku',status:'raw',age:'1w',tags:['tooling','writing'],shape:2,tilt:2,projectName:'Seventeen Syllables',sauceOpen:true}),
  h(C.NuggetCard,{title:'A board game about queueing at the post office',status:'parked',age:'3w',tags:['games'],shape:3,tilt:-2}))`
  },
  NuggetMark: {
    group: 'Nuggets', height: 170,
    readme: `The nugget motif: a generated lumpy nugget with an ink shadow, a shine and crumbs. It does the job a logo would.

**Provide** \`size\` (width in px) and a \`seed\`; the same seed always draws the same nugget, so derive it from whatever the nugget stands for. \`status\` changes the fill to that status's colour. Give it a \`label\` only when it carries meaning on its own; otherwise it is decorative and hidden from assistive tech.

Use it for the "FIG. 1" sketch beside a caption, empty states and favicons. **Don't** put text on it; that is what \`NuggetCard\` is for.`,
    body: `h('div',{style:{display:'flex',gap:28,alignItems:'flex-end',padding:20}},h(C.NuggetMark,{size:140,seed:19}),h(C.NuggetMark,{size:96,seed:5,status:'raw'}),h(C.NuggetMark,{size:72,seed:31}),h(C.NuggetMark,{size:56,seed:13,status:'killed'}))`
  },
  SpeechBubble: {
    group: 'Nuggets', height: 200,
    readme: `A speech bubble with an inked tail: a nugget saying its own notes, or a shout from an illustration.

**Provide** the text as children. On a nugget's page use \`tail="left"\` so the tail points at the hero panel; put the first paragraph in \`lead\` and the rest in \`body\` \`ink-soft\`. Set \`editing\` while the notes are editable; the fill turns \`mayo\`. For a shout ("PSST! TIP ME!") use \`tail="bottom"\` with an \`Sfx size="sm"\` inside.`,
    body: `h('div',{style:{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:36,padding:'20px 20px 34px 44px',alignItems:'start'}},
  h(C.SpeechBubble,null,h('p',{className:'lead',style:{margin:0}},'Photograph a receipt, get a one-line roast of the purchase.'),h('p',{className:'body',style:{margin:'10px 0 0',color:'var(--ink-soft)'}},'The roast needs a dial: gentle, honest, ruthless.')),
  h(C.SpeechBubble,{tail:'bottom',style:{textAlign:'center'}},h(C.Sfx,{size:'sm',tilt:-3},'PSST! TIP ME!')))`
  },
  Sfx: {
    group: 'Nuggets', height: 190,
    readme: `Sound-effect lettering in Bangers with an ink outline, for one event at a time.

**Sizes:** \`lg\` (120px, ink shadow) pops over the page during an event and leaves: TIP! when the bucket tips, PLOP! when a nugget lands. \`md\` (56px) rests inside a feature panel: CRUNCH! on a nugget's hero. \`sm\` (40px, plain ink) is a shout inside a \`SpeechBubble\`.

**Provide** the word in capitals with an exclamation mark, a \`tone\` (\`nugget\` or \`tomato\`) and a \`tilt\`. It is decorative by default. **Never** more than one on screen, never on a button, never for an error or a confirmation.`,
    body: `h('div',{style:{display:'flex',gap:36,alignItems:'center',padding:'24px 28px'}},h(C.Sfx,{size:'lg'},'TIP!'),h(C.Sfx,{size:'md',tone:'tomato',tilt:8},'CRUNCH!'),h(C.Sfx,{size:'sm',tilt:-4},'PSST!'))`
  },
  Burst: {
    group: 'Layout', height: 260,
    readme: `A sunburst of \`paper\` rays on \`mayo\`, behind the one feature illustration on a page.

**Provide** the illustration as children (the bucket, a nugget's hero); they are centred over the rays. Put it inside a \`Panel\` with \`padded={false}\`, or give the Burst itself the panel's line. One per screen. \`rays\` changes the count (even numbers; default 44).`,
    body: `h('div',{style:{padding:14}},h(C.Burst,{className:'cs-panel',style:{height:220,display:'flex',alignItems:'center',justifyContent:'center'}},h(C.NuggetMark,{size:180,seed:19})))`
  },
  CaptionBox: {
    group: 'Feedback', height: 200,
    readme: `A narration box: the strip's yellow caption in the corner of a panel. It talks about the page rather than being part of it.

**Use it for** notices: "Meanwhile, on the tray… 3 new nuggets landed. The tray catches up when you save or cancel." while a dialog is open over a live tray. \`tone="mayo"\` or \`"paper"\` when it sits on a nugget-gold strip.

**Provide** an \`eyebrow\` in the narrator's voice ("Meanwhile, on the tray…", "Previously…") and the plain sentence as children. Give it \`role="status"\` when it appears in response to something.

\`tone="error"\` is paper with a red-ink (\`tomato\`) line, for a failed action; use it through \`ActionError\`, which says the error in plain words with no eyebrow. A field's own error stays literal text under that field. \`EmptyState\` is a caption box too.`,
    body: `h('div',{style:{display:'grid',gap:14,padding:20,maxWidth:560}},h(C.CaptionBox,{eyebrow:'Meanwhile, on the tray…',role:'status'},'3 new nuggets landed. The tray catches up when you save or cancel.'),h(C.CaptionBox,{tone:'mayo',eyebrow:'Previously, in your notes app…'},'Twenty half-formed thoughts, kept warm.'),h(C.CaptionBox,{tone:'error'},'GitHub refused the token.'))`
  },
  Dialog: {
    group: 'Layout', height: 330,
    readme: `A panel that sits on the page like a sticker: \`shadow-sticker\` behind it, a \`title\` heading, a round close button, and a \`mayo\` footer for its pills.

**Provide** \`title\` (sentence case with a full stop, "Edit nugget."), an optional \`description\` (one \`ink-soft\` line under the title, wired with \`aria-describedby\`), \`onClose\`, the body as children (a \`CaptionBox\` first if the page changed underneath, then \`Field\`s), and a \`footer\` with "Cancel" (paper) then the one \`tomato\` pill ("Save").

It is presentational: the host renders the dimmed overlay (\`ink\` at 40%), traps focus, closes on Escape and returns focus to what opened it. 560px wide by default; it goes full width with the \`page\` margin under 700px.`,
    body: `h('div',{style:{padding:'20px 34px 34px 20px'}},h(C.Dialog,{title:'Edit nugget.',onClose:()=>{},footer:[h(C.Pill,{key:'c'},'Cancel'),h(C.Pill,{key:'s',variant:'tomato'},'Save')]},h(C.Field,{label:'Title',defaultValue:'A receipt scanner that argues back'})))`
  },
  Field: {
    group: 'Forms', height: 210,
    readme: `A labelled text input (or \`multiline\` textarea) in a dialog, with an optional \`hint\` under it.

**Provide** \`label\` (it is set as an uppercase \`label\` caption; write it in sentence case), and the usual input props. \`hint\` is plain \`ink-soft\` help or a literal error ("A nugget needs a title."); it is wired to the input with \`aria-describedby\`. \`action\` puts a control (a \`Pill\`) at the end of the input row, as the name generator does with its dice.

Fields use \`line-thin\` and \`radius-field\`, never the pill shape: the pill shape is for things you press.`,
    body: `h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,padding:20}},h(C.Field,{label:'Title',placeholder:'What is it, in a line?',defaultValue:'Commit messages as haiku'}),h(C.Field,{label:'Title',placeholder:'What is it, in a line?',hint:'A nugget needs a title.'}),h(C.Field,{label:'Notes',multiline:true,defaultValue:'Five, seven, five. The linter counts syllables.',style:{gridColumn:'1 / -1'}}))`
  },
  NameSuggestions: {
    group: 'Nuggets', height: 300,
    readme: `The project-name generator in the Edit nugget dialog: the "Suggested project name" field, a dice pill that asks kimi-no-name-wa for five names from the notes, the names as tilted stickers, and a two-line box saying why the pointed-at name was suggested.

**States** (\`state\`, plus \`available\` and \`notesEmpty\`):
- **Idle, no names yet:** the pill reads "Roll names". Disabled with a literal hint when the notes are empty ("Write some notes and kimi will name it") or kimi is down ("kimi is not available at the moment").
- **Rolling:** the dice spins and the pill reads "Stop"; pressing it cancels the request and keeps whatever names were showing.
- **Names:** five \`nugget\` stickers with \`shadow-stamp\`, each tilted a little differently, in a listbox. Pointing at or focusing one shows its explanation in the box below, which is always two lines tall so nothing shifts. Picking one fills the field; the picked sticker turns \`curry\` with a check, the same sauce that will mark the nugget on the tray. The pill now reads "Re-roll" and asks for five names kimi has not shown this session.
- **Failed:** the names stay and a status line says kimi is not available.

**Provide** \`names\` (\`{name, explanation}\`), \`value\`, \`onChange\`, \`onPick\`, \`onRoll\` and \`onCancel\`. The field is plain text: kimi only suggests. **No sparkle emoji**; the dice is the generator's mark.`,
    body: `h('div',{style:{padding:20,maxWidth:560}},h(C.NameSuggestions,{value:'Golden Hour',available:true,names:[{name:'Nutgets',explanation:'A nugget that nets you the money you spent.'},{name:'Golden Hour',explanation:'The receipt glows gold and the roast lands right on time.'},{name:'WingIt',explanation:'For the purchases you did not plan.'},{name:'Pollomotion',explanation:'Receipts in, roasts out, at speed.'},{name:'Drumstick',explanation:'It beats you over the head about the drumsticks.'}]}))`
  },
  SuggestedTags: {
    group: 'Nuggets', height: 280,
    readme: `Tags suggested for a nugget, pencilled in: a dashed \`ink-soft\` tray labelled "SUGGESTED" with a pencil, at the end of the nugget's tag row. Each suggestion is a dashed chip with a ⊕ and its \`#tag\`, then ×.

- **Click the tag** to ink it in (add it). **×** rubs it out (dismisses it). While either is in flight the chip dims and is \`aria-disabled\`, so focus is not dropped.
- **Hover or focus** a chip: after 250ms it inks up (solid line, \`mayo\` fill, \`nugget\` ⊕) and a \`ThoughtBubble\` floats below it with why: "Suggested because it reads like these nuggets tagged **#animation**:" and the example titles, then "click to ink it in · × to rub it out". It opens leftwards near the right edge, closes the moment both pointer and focus leave, and Escape closes it. The probability is never shown.
- The add button's label is literal ("Add the suggested tag animation") and is described by the bubble.

**Provide** \`suggestions\` (\`{tag, examples}\`), \`onAdd\`, \`onDismiss\` and \`busy\` (the tag in flight). It renders nothing when there are none. \`openTag\` holds one bubble open, for previews only.`,
    body: `h('div',{style:{display:'flex',flexWrap:'wrap',alignItems:'center',gap:8,padding:'20px 20px 200px'}},h(C.Chip,{pressed:true},'#2'),h(C.SuggestedTags,{openTag:'animation',suggestions:[{tag:'animation',examples:['nuggets site animation','website animation idea 1']},{tag:'nuggets',examples:['nuggets bucket redesign']},{tag:'website',examples:[]}]}))`
  },
  ThoughtBubble: {
    group: 'Nuggets', height: 200,
    readme: `A thought bubble: a \`paper\` cloud with an ink line and \`shadow-thought\`, and two puffs trailing back up to what it is about. It is how the system shows a reason or an aside, as opposed to a \`SpeechBubble\`, which is something said.

**Use it for** why a tag or name was suggested, anchored under the chip. \`side="left"\` when it would run off the right edge. Keep it to a sentence, a short list and a mono footer (\`thought-foot\`) of what you can do. **Don't** put buttons in it; it vanishes when the pointer leaves.`,
    body: `h('div',{style:{display:'flex',gap:40,padding:20}},h(C.ThoughtBubble,null,'Suggested because it reads like these nuggets tagged ',h('b',null,'#animation'),':',h('ul',null,h('li',null,'nuggets site animation'),h('li',null,'website animation idea 1')),h('span',{className:'cs-thought-foot'},'click to ink it in · × to rub it out')),h(C.ThoughtBubble,{side:'left'},'Suggested from nuggets already tagged ',h('b',null,'#website'),'.'))`
  },
  StatePill: {
    group: 'Status', height: 80,
    readme: `The state of a connection or a queued job, as a word on a fill: what Settings says about spices, GitHub, kimi and Jev, and what a feature request says about GitHub. \`StatusPill\` is a nugget's status; this is everything else.

**Tones** (\`tone\`), each with its word as children so colour is never the only signal:
- \`ok\` (\`pickle\`): "Connected", "Sent".
- \`off\` (paper, dashed \`ink-soft\` line): "Not connected".
- \`wait\` (\`raw\`): "Queued".
- \`attention\` (\`tomato\`, ink text): "Needs re-sync", when the captain has to act before anything moves.
- \`error\` (paper, red-ink line): "Failed", or "Error" beside a connection's last error.

Uppercase bold mono, \`line-thin\`, like \`StatusPill\`. **Don't** use it for a nugget's status.`,
    body: `h('div',{style:{display:'flex',gap:10,flexWrap:'wrap',padding:20}},h(C.StatePill,{tone:'ok'},'Connected'),h(C.StatePill,{tone:'off'},'Not connected'),h(C.StatePill,{tone:'wait'},'Queued'),h(C.StatePill,{tone:'attention'},'Needs re-sync'),h(C.StatePill,{tone:'error'},'Failed'))`
  },
  ActionError: {
    group: 'Feedback', height: 150,
    readme: `A failed action, said plainly: a \`CaptionBox\` with \`tone="error"\` (paper, red-ink line), \`role="alert"\`, the message, and a small "Dismiss" pill. Each screen shows its own at the top; there are no toasts.

**Provide** \`message\` (it renders nothing without one) and \`onDismiss\`. Leave \`onDismiss\` out where the error clears itself on the next try, as in a settings section or Plan with Claude.

**Errors are literal.** Say what failed in the server's own words ("GitHub refused the token."), no eyebrow, no apology, and **never** a "POW!" or any other sound effect or burst.`,
    body: `h('div',{style:{display:'grid',gap:14,padding:20,maxWidth:560}},h(C.ActionError,{message:'The nugget could not be restored: it is already in the bank.',onDismiss:()=>{}}),h(C.ActionError,{message:'Something went wrong.'}))`
  },
  EmptyState: {
    group: 'Feedback', height: 170,
    readme: `Nothing to show, said by the narrator: a \`CaptionBox\` with a "Meanwhile…" eyebrow, the headline as a heading, a line of help and at most one action.

**Provide** \`headline\` (the same words the Classic look uses, since both looks share their headings: "Trash is empty"), an optional \`body\` and \`action\` (one \`Pill\`), and an \`eyebrow\` that says where we are: "Meanwhile, in the bin…", "Meanwhile, on the tray…". It defaults to "Meanwhile…".

Keep the joke in the eyebrow and keep it small; the headline and body stay plain. **No** illustration: the voice does the work.`,
    body: `h('div',{style:{display:'grid',gap:14,padding:20,maxWidth:560}},h(C.EmptyState,{eyebrow:'Meanwhile, in the bin…',headline:'Trash is empty',body:'Archived nuggets land here. Nothing has been binned yet.'}),h(C.EmptyState,{eyebrow:'Meanwhile, on the tray…',headline:'Nothing on the tray matches',body:'Try another word.',action:h(C.Pill,{size:'sm'},'Clear the search')}))`
  },
  BinCard: {
    group: 'Nuggets', height: 300,
    readme: `A binned nugget: its card greyed out and tipped further over than on the tray, with "Restore" and "Purge" under it. A binned card doesn't open and doesn't lift on hover.

**Provide** \`title\`, \`tags\`, \`archivedAt\` (when it was binned, "2d ago"), \`shape\`, \`tilt\` (about ±5° to ±8°, more than a tray card) and \`onRestore\` / \`onPurge\`. It renders an \`li\`; \`Bin\` lays them out in a list.

"Restore" is a small paper pill; "Purge" is a small \`danger\` pill, outlined in red ink, not filled. Purge always asks first: a \`Dialog\` titled "Purge this nugget?" saying "It's gone for good — restoring won't be an option.", with "Keep it" and a \`danger\` "Purge".`,
    body: `h('div',{style:{display:'flex',flexWrap:'wrap',gap:'24px 48px',padding:'24px 28px',alignItems:'flex-start'}},h('ul',{style:{listStyle:'none',margin:0,padding:0,width:260}},h(C.BinCard,{title:'A receipt scanner that argues back',tags:['saas'],archivedAt:'2d ago',shape:0,tilt:-7})),h(C.Dialog,{title:'Purge this nugget?',description:"It's gone for good — restoring won't be an option.",width:400,onClose:()=>{},footer:[h(C.Pill,{key:'k'},'Keep it'),h(C.Pill,{key:'p',variant:'danger'},'Purge')]}))`
  },
  Bin: {
    group: 'Screens', height: 520,
    readme: `The bin (Trash): binned nuggets, newest binned first, as greyed \`BinCard\`s under a caption that says what Restore and Purge do. Empty, it is an \`EmptyState\`: "Meanwhile, in the bin…" / "Trash is empty".

**Provide** \`ideas\` (\`{id, title, tags, archivedAt}\`, newest first), \`onRestore(id)\` and \`onPurge(id)\`. Each card's shape and tilt come from its id, so a nugget looks the same every visit. Cards sit straight on the page in an auto-filling grid (230px minimum), not on the tray: the bin is not the tray.

The page around it is a \`Strip\` with "Back to the bank" and Settings, then an \`ActionError\` if Restore or Purge failed, then the bin.`,
    body: `h('div',{style:{display:'grid',gap:28,padding:'20px 24px'}},h(C.Bin,{ideas:[{id:1,title:'A receipt scanner that argues back',tags:['saas','writing'],archivedAt:'2d ago'},{id:2,title:'Commit messages as haiku',tags:['tooling'],archivedAt:'1w ago'},{id:3,title:'A board game about queueing at the post office',tags:['games'],archivedAt:'3w ago'}]}),h(C.Bin,{ideas:[]}))`
  },
  LookPicker: {
    group: 'Forms', height: 180,
    readme: `The Look picker at the top of Settings: Classic and Comic as two tilted sticker tiles in a radio group legended "Look". Each tile is a real radio, named "Classic" or "Comic", with a picture of its look: a plain grey-lined card for Classic, a \`NuggetMark\` for Comic.

The picked tile fills \`nugget\`, gains a check and lifts onto \`shadow-sticker\`; the other sits flat on \`shadow-stamp\`. Arrow keys move between them, as in any radio group.

**Provide** \`value\` (\`'classic'\` or \`'comic'\`) and \`onChange\`. Set \`comicInProgress\` while some screens still fall back to Classic: the Comic tile wears an "In progress" tag, which describes it rather than renaming it. \`hint\` adds a line under the tiles. The look applies at once; there is no Save.`,
    body: `h('div',{style:{padding:'24px 20px'}},h(C.LookPicker,{value:'comic',comicInProgress:true,hint:'Only how nuggets looks changes. Your nuggets stay as they are.'}))`
  },
  SettingsSection: {
    group: 'Screens', height: 900,
    readme: `One integration in the Settings dialog: a \`mayo\` caption-box heading (the integration's name as an \`h3\` plus a line on what it does), a status line, a literal error, its \`Field\`s and its pills. Sections stack in the comic \`Dialog\` titled "Settings", under the \`LookPicker\`, divided by an ink line.

**Provide** \`title\` and \`description\` (the Classic look's words: "spices", "GitHub", "kimi", "Tag suggestions"), then:
- \`status\`: a \`StatePill\`: \`ok\` "Connected", \`off\` "Not connected", \`attention\` "Needs re-sync" or \`error\` "Error"; and \`detail\`, mono \`ink-soft\` facts on the right ("every 60s · synced 2 min ago", "2 queued · 1 failed").
- \`error\`: the message, shown as an \`ActionError\` without Dismiss.
- children: the \`Field\`s and any notes.
- \`dangerAction\`: "Disconnect" as a small \`danger\` pill, on the left.
- \`actions\`: the rest on the right, the commit last: "Change" / "Sync now", "Cancel" / "Save", "Not yet" / "Re-sync", "Connect", "Change key". All paper: with four sections in one dialog, a tomato pill in each would make four primaries.

There is no Test pill: the Classic look has none, and a connection proves itself on Save. kimi has no status pill; it says "Saved." in a status line instead.`,
    body: `h('div',{style:{padding:'20px 34px 34px 20px'}},h(C.Dialog,{title:'Settings',description:"Where nuggets arrive from, and where they're sent.",width:600,onClose:()=>{}},
  h(C.LookPicker,{value:'comic',comicInProgress:true}),
  h(C.SettingsSection,{title:'spices',description:'Pull ideas from your spices capture bot.',status:h(C.StatePill,{tone:'attention'},'Needs re-sync'),detail:'http://127.0.0.1:8080 · synced 3 days ago · every 60s',dangerAction:h(C.Pill,{size:'sm',variant:'danger'},'Disconnect'),actions:[h(C.Pill,{key:'c',size:'sm'},'Change'),h(C.Pill,{key:'r',size:'sm'},'Re-sync')]},h('p',{className:'body',style:{margin:0}},'The spices on the other end may hand out the same ids for different ideas, so nothing is pulled until you re-sync. Your nuggets are untouched.')),
  h(C.SettingsSection,{title:'GitHub',description:'Open a feature-request issue for each nugget that gets one of these tags.',status:h(C.StatePill,{tone:'error'},'Error'),detail:'2 queued · 1 failed',error:'GitHub refused the token.',dangerAction:h(C.Pill,{size:'sm',variant:'danger'},'Disconnect'),actions:[h(C.Pill,{key:'x',size:'sm'},'Cancel'),h(C.Pill,{key:'s',size:'sm'},'Save')]},h(C.Field,{label:'Personal access token',type:'password',placeholder:'Leave empty to keep the current token'}),h('div',{style:{display:'grid',gridTemplateColumns:'2fr 3fr',gap:10}},h(C.Field,{label:'Tag',defaultValue:'nuggets'}),h(C.Field,{label:'Repository',defaultValue:'Jarrod-Bob/nuggets'}))),
  h(C.SettingsSection,{title:'kimi',description:'Suggest project names for nuggets with kimi-no-name-wa, running on this machine.',actions:h(C.Pill,{size:'sm'},'Save')},h(C.Field,{label:'kimi address',type:'url',defaultValue:'http://127.0.0.1:7799'})),
  h(C.SettingsSection,{title:'Tag suggestions',description:'Suggest tags you already use that a nugget seems to be missing. Nothing is tagged until you add it.',status:h(C.StatePill,{tone:'ok'},'Connected'),detail:'3 nuggets waiting to be checked',dangerAction:h(C.Pill,{size:'sm',variant:'danger'},'Disconnect'),actions:h(C.Pill,{size:'sm'},'Change key')})))`
  },
  PlanWithClaude: {
    group: 'Screens', height: 820,
    readme: `Plan with Claude: a \`Dialog\` holding the planning prompt in a \`SpeechBubble\` (it is what you will say to Claude), set in Space Mono and scrollable, then the ways to send it, then a field to bring Claude's answer back into the notes.

**Pills:** "Open in Claude Desktop" (the \`tomato\` one, a link to the \`claude://\` deep link), "Copy & open claude.ai" and "Copy prompt", then "Save to notes" under the answer, disabled until there is one. The footer has "Close".

**Provide** \`prompt\`, \`desktopUrl\`, \`trimmed\` (the deep link carries trimmed notes; a status line says so), \`copyNote\` (the result of a copy, "Copied the full prompt."), \`answer\` / \`onAnswerChange\`, \`onCopy\`, \`onCopyAndOpen\`, \`onSave\`, \`saving\`, \`saveError\` and \`onClose\`. The prompt is focusable and named "Planning prompt" so it can be scrolled and selected by keyboard.`,
    body: `h('div',{style:{padding:'20px 34px 34px 20px'}},h(C.PlanWithClaude,{onClose:()=>{},desktopUrl:'#',copyNote:'Copied the full prompt.',prompt:'Help me plan this idea from my idea bank.\\n\\nTitle: A receipt scanner that argues back\\nNotes: Photograph a receipt, get a one-line roast of the purchase. The roast needs a dial: gentle, honest, ruthless.\\nTags: saas, writing\\n\\nAsk me three questions first, then propose the smallest version I could build this weekend.'}))`
  },
  RandomNugget: {
    group: 'Screens', height: 600,
    readme: `Draw a nugget's result: a \`Dialog\` titled "Your challenge" with the drawn nugget's card dropped in from above at a tilt (620ms, the house bounce) and a red-ink "PICK ME" rubber stamp thumped onto its corner after it lands. Under the card: its notes, then the dealt challenge in a \`mayo\` box, a "Timebox" and a "Build it with" row, each with its own small reroll pill, and the survey the stacks are weighted by.

**Pills:** "Reroll timebox", "Reroll stack", and in the footer "Close" and the \`tomato\` "Reroll nugget", which drops a fresh card (the card is keyed by the nugget, so a new draw replays the drop).

**States:** \`loading\` titles it "Drawing…" and says "Drawing a nugget…"; no \`idea\` titles it "Nothing to draw" with a caption: "Meanwhile, on the tray… No active nuggets match that tag. Drop one in first."

**Provide** \`idea\` (\`{id, title, notes, tags, status}\`), \`tag\` (shown on the card as "narrowed to …"), \`timebox\` (its label), \`stack\` (\`{language, framework, track}\`, the track as its label), \`source\` (\`{label, url, retrieved}\`), \`loading\`, and \`onReroll\`, \`onRerollTimebox\`, \`onRerollStack\`, \`onClose\`.

The stamp is a stamp, not a sound effect: display type, not Bangers, and hidden from assistive tech. Under reduced motion the card is simply there with its stamp.`,
    body: `h('div',{style:{padding:'20px 34px 34px 20px'}},h(C.RandomNugget,{onClose:()=>{},tag:'saas',idea:{id:14,title:'A receipt scanner that argues back',notes:'Photograph a receipt, get a one-line roast of the purchase.',tags:['saas','writing'],status:'building'},timebox:'One evening',stack:{language:'TypeScript',framework:'React',track:'Web'},source:{label:'Stack Overflow 2025',url:'#',retrieved:'2026-08-01'}}))`
  },
  FeatureRequests: {
    group: 'Nuggets', height: 230,
    readme: `A nugget's GitHub feature requests as a strip of small panels, one per request: what it is ("Feature request #42", a link to the issue; "Feature request queued"; "Feature request failed"), the repo in mono, a \`StatePill\` (\`ok\` "Sent", \`wait\` "Queued", \`error\` "Failed"), GitHub's last error when it has one, and a small "Retry" pill on a failed one. A failed panel's line turns red ink.

**Provide** \`requests\` (\`{id, repo, state, number, url, last_error}\`), \`onRetry(id)\` and \`retrying\` (the id whose Retry is in flight; its pill is disabled). It renders nothing for a nugget with none.

Lay it as its own row of the nugget page's panel grid, under the action panel, never inside another panel. The panels auto-fill at 220px minimum and stack to one column on a phone.`,
    body: `h('div',{style:{padding:20}},h(C.FeatureRequests,{requests:[{id:1,repo:'Jarrod-Bob/nuggets',state:'created',number:42,url:'#'},{id:2,repo:'Jarrod-Bob/spices',state:'pending'},{id:3,repo:'Jarrod-Bob/typesafe',state:'failed',last_error:'GitHub refused the token.'}]}))`
  }
};

for (const [name, c] of Object.entries(C)) {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'README.md'), `# ${name}\n\n${c.readme}\n`);
  fs.writeFileSync(path.join(dir, 'preview.html'),
`<!-- @dsCard group="${c.group}" height=${c.height} -->
<!doctype html>
<html>
<head><meta charset="utf-8"><title>${name} — preview</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bangers&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Instrument+Sans:wght@400;600;700&family=Space+Mono:wght@400;700&display=swap">
<style>body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--font-body)}</style>
</head>
<body>
<div id="root"></div>
<script>
  var C = window.Comic, h = React.createElement;
  ReactDOM.createRoot(document.getElementById('root')).render(${c.body});
</script>
</body>
</html>
`);
}
console.log('wrote', Object.keys(C).length);
