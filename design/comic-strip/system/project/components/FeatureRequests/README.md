# FeatureRequests

A nugget's GitHub feature requests as a strip of small panels, one per request: what it is ("Feature request #42", a link to the issue; "Feature request queued"; "Feature request failed"), the repo in mono, a `StatePill` (`ok` "Sent", `wait` "Queued", `error` "Failed"), GitHub's last error when it has one, and a small "Retry" pill on a failed one. A failed panel's line turns red ink.

**Provide** `requests` (`{id, repo, state, number, url, last_error}`), `onRetry(id)` and `retrying` (the id whose Retry is in flight; its pill is disabled). It renders nothing for a nugget with none.

Lay it as its own row of the nugget page's panel grid, under the action panel, never inside another panel. The panels auto-fill at 220px minimum and stack to one column on a phone.
