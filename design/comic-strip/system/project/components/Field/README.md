# Field

A labelled text input (or `multiline` textarea) in a dialog, with an optional `hint` under it.

**Provide** `label` (it is set as an uppercase `label` caption; write it in sentence case), and the usual input props. `hint` is plain `ink-soft` help or a literal error ("A nugget needs a title."); it is wired to the input with `aria-describedby`. `action` puts a control (a `Pill`) at the end of the input row, as the name generator does with its dice.

Fields use `line-thin` and `radius-field`, never the pill shape: the pill shape is for things you press.
