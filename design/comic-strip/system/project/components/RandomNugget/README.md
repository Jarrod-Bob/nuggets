# RandomNugget

Draw a nugget's result: a `Dialog` titled "Your challenge" with the drawn nugget's card dropped in from above at a tilt (620ms, the house bounce) and a red-ink "PICK ME" rubber stamp thumped onto its corner after it lands. Under the card: its notes, then the dealt challenge in a `mayo` box, a "Timebox" and a "Build it with" row, each with its own small reroll pill, and the survey the stacks are weighted by.

**Pills:** "Reroll timebox", "Reroll stack", and in the footer "Close" and the `tomato` "Reroll nugget", which drops a fresh card (the card is keyed by the nugget, so a new draw replays the drop).

**States:** `loading` titles it "Drawing…" and says "Drawing a nugget…"; no `idea` titles it "Nothing to draw" with a caption: "Meanwhile, on the tray… No active nuggets match that tag. Drop one in first."

**Provide** `idea` (`{id, title, notes, tags, status}`), `tag` (shown on the card as "narrowed to …"), `timebox` (its label), `stack` (`{language, framework, track}`, the track as its label), `source` (`{label, url, retrieved}`), `loading`, and `onReroll`, `onRerollTimebox`, `onRerollStack`, `onClose`.

The stamp is a stamp, not a sound effect: display type, not Bangers, and hidden from assistive tech. Under reduced motion the card is simply there with its stamp.
