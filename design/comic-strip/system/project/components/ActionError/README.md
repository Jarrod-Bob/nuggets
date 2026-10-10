# ActionError

A failed action, said plainly: a `CaptionBox` with `tone="error"` (paper, red-ink line), `role="alert"`, the message, and a small "Dismiss" pill. Each screen shows its own at the top; there are no toasts.

**Provide** `message` (it renders nothing without one) and `onDismiss`. Leave `onDismiss` out where the error clears itself on the next try, as in a settings section or Plan with Claude.

**Errors are literal.** Say what failed in the server's own words ("GitHub refused the token."), no eyebrow, no apology, and **never** a "POW!" or any other sound effect or burst.
