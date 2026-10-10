# PlanWithClaude

Plan with Claude: a `Dialog` holding the planning prompt in a `SpeechBubble` (it is what you will say to Claude), set in Space Mono and scrollable, then the ways to send it, then a field to bring Claude's answer back into the notes.

**Pills:** "Open in Claude Desktop" (the `tomato` one, a link to the `claude://` deep link), "Copy & open claude.ai" and "Copy prompt", then "Save to notes" under the answer, disabled until there is one. The footer has "Close".

**Provide** `prompt`, `desktopUrl`, `trimmed` (the deep link carries trimmed notes; a status line says so), `copyNote` (the result of a copy, "Copied the full prompt."), `answer` / `onAnswerChange`, `onCopy`, `onCopyAndOpen`, `onSave`, `saving`, `saveError` and `onClose`. The prompt is focusable and named "Planning prompt" so it can be scrolled and selected by keyboard.
