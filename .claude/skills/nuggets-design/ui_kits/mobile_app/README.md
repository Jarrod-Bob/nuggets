# UI kit — nuggets on a phone

**Speculative.** The MVP spec puts mobile and responsive layouts explicitly out of
scope (§2). This kit is the design for the path the spec *does* keep open — §9.1:
install Tailscale on the PC and the phone, bind the Go server to the tailnet, and
browse to it. Zero code changes; "the remaining work is a responsive CSS pass —
the one bounded cost of building desktop-only."

So this is that CSS pass, not a new product. **Same single screen, same two
dialogs, same endpoints** — nothing here needs an API that doesn't already exist.

## What changes on a phone

| Desktop | Phone |
| --- | --- |
| 60px top bar, wordmark + search + 3 actions | 2-row sticky header: wordmark, draw, trash toggle; search on its own line |
| Tag filter wraps | Tag filter scrolls horizontally |
| "Drop a nugget" button in the header | Full-width button docked at the bottom, above the safe area |
| Edit and archive icons per row | Archive only; tapping the row opens the edit dialog |
| Dialogs 430–520px | Dialogs fill the width at 330px |

Everything else — fluid card shapes, tag dips, inline validation, restore/purge,
the stateless draw — is identical.

Data comes from `../web_app/data.js`, so both kits show the same bank.
