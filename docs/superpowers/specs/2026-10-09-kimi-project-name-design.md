# nuggets — Suggested Project Names from kimi-no-name-wa

**Date:** 2026-10-09
**Status:** Approved, not yet implemented
**Issue:** closes [#26](https://github.com/Jarrod-Bob/nuggets/issues/26)
**Builds on:** [`2026-09-26-spices-pull-design.md`](2026-09-26-spices-pull-design.md) (the settings table, each integration owning its keys, the "unedited" rule) and the sibling app [kimi-no-name-wa](https://github.com/Jarrod-Bob/kimi-no-name-wa) (its README "API" section is the contract this spec relies on).

Terms (**Title**, **Notes**, **Project name**) are defined in [`CONTEXT.md`](../../../CONTEXT.md).

## 1. Problem

A nugget's title says what the idea *is* ("A bank for the little ideas I have while I'm out"). Ideas that might get built deserve a name worth building under, and kimi-no-name-wa, a local app on the same machine, already generates witty project names from a description. The captain wants a button in nuggets that asks kimi for one.

## 2. Behaviour

- A nugget gets an optional **project name**, kept alongside its title. The title stays required and stays the nugget's headline everywhere.
- The project name is an ordinary text field. It can be typed, edited or cleared by hand, and kimi only suggests values for it. It is trimmed, and blank means none. Like the title, it has no length limit.
- **Generate** sends the nugget's **notes**, and only the notes, as kimi's `description`. The title is not sent.
- Kimi returns a list of **5 suggestions**, each with its explanation. Picking one fills the project-name field. **Re-roll** asks again with every name already shown this form session in `avoid`. The list is discarded when the form closes.
- **An empty title borrows the pick.** If the title field is empty when a suggestion is picked, the name is copied into the title field too, where it can be edited before saving. Nothing else copies a name into the title: a typed project name with an empty title still gets "A nugget needs a title."
- Tones and count are not configurable. Nuggets sends no `tones` (kimi defaults to witty, punny and sleek), `count: 5` and `client: "nuggets"`.
- **Search** in the bank matches the project name, as well as the title and notes.
- **Spices** never sets or clears a project name. A save whose only change is the project name leaves a nugget *unedited* in the spices sense, so spices keeps refreshing its title and notes.
- **GitHub feature requests** ignore the project name. The issue title and the same-idea match still use the title and notes.
- **Plan with Claude** adds a `Working name: <project name>` line to the prompt when there is one. Draw-a-nugget and card shapes keep using the title.

## 3. Configuration

Settings key, owned by a new `internal/kimi` package (`config.go`):

| Key | Holds | Default when missing |
|---|---|---|
| `kimi_url` | kimi-no-name-wa's base URL | `http://127.0.0.1:7799` |

Validation: an absolute `http://` or `https://` URL with no query or fragment. A trailing `/` is dropped.

There is no on/off switch. If kimi isn't running, the button reports it as unavailable (§5).

## 4. API

Nuggets' server calls kimi. The browser never does: kimi grants no CORS, requires `Content-Type: application/json` and checks the `Host` header, so a page served by nuggets can't call it directly, by kimi's design.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/settings/kimi` | `{url}` |
| `PUT` | `/api/settings/kimi` | `{url}`. Returns the saved settings, or `400` with a message. |
| `GET` | `/api/kimi/health` | `{available: bool}`. Calls kimi's `GET /api/v1/health`. Available only when kimi answers with `status: "ok"`. Unreachable, `degraded` or any error means `false`. |
| `POST` | `/api/kimi/names` | Body `{notes, avoid?}`. Response `{names: [{name, explanation, technique, tone}]}`. |

`POST /api/kimi/names` errors:

| Status | When |
|---|---|
| `400` | `notes` is blank after trimming, or `avoid` holds more than 500 entries. |
| `503` | Kimi is unreachable, or answered with `ollama_unreachable` or `model_missing`. |
| `502` + `code: "kimi_model_error"` | Kimi answered with `model_error`: it is up, but its Ollama model couldn't run. |
| `502` | Any other failure from kimi, including `no_names` and `model_timeout`. |

Each error body uses nuggets' usual error shape. Only the `model_error` case carries a `code` (`{"error":{"message","code"}}`), because kimi's health still says `ok` then and the UI must tell it apart from kimi being off (issue #36). The UI shows one of two fixed texts (§5), never kimi's own message, which is logged.

**Client.** `kimi.Client` is built once in `cmd/nuggets/main.go` and handed to the handlers. Handlers don't construct their own. Calls are request-scoped rather than a background loop: each one is made when the captain clicks, and it is cancelled when the browser request is (the request's context is passed through). The `AGENTS.md` "one goroutine per external service" rule targets the background importers. This integration keeps the part that matters, a single client, and needs no loop. The client has its own 6-minute timeout, just over kimi's 5-minute model timeout. The nuggets server has no `WriteTimeout`, so long first calls (model loading) aren't cut off.

## 5. UI

**Form** (`IdeaForm`, create and edit):

- A **"Suggested project name"** input below Title, with a ✨ generate button inside or beside it. Its tooltip reads: "Uses kimi-no-name-wa to generate a creative name for your project!"
- The button's state:
  - **Notes empty:** disabled, with the hint "Write some notes and kimi will name it".
  - **Kimi unavailable:** disabled, with the text "kimi is not available at the moment". Health is checked when the form opens.
  - **Ready:** enabled.
  - **Naming…:** a cancel control replaces the button. The rest of the form stays editable while it runs.
- Results show as a list of 5 rows (name and explanation) under the field, with **Re-roll**. Clicking a row fills the field (and an empty title, §2).
- If a request fails, the list area shows "kimi is not available at the moment", and the button stays enabled for another try.
- If kimi answers `model_error` (`code: "kimi_model_error"`, §4), the list area shows "kimi's model couldn't run; check Ollama on the GPU machine" instead, and the button is disabled for the rest of the form session: every try would wait just as long and fail the same way. Reopening the form checks health again (issue #36).
- Project-name changes count toward the form's dirty state.

**Display:**

- The **nugget page** and **cards** show the title as the headline. When there is a project name, they also show it under the title, as "Suggested project name: Ideanori".
- **Trash** shows the title only, as today.

**Settings:** a "kimi" section with the URL field and Save, styled like the spices and GitHub sections.

## 6. Data

Migration `00007_project_name.sql` adds `ideas.project_name TEXT NOT NULL DEFAULT ''`.

- `Idea` gains `ProjectName` (`json:"project_name"`). `Draft` and the patch shape gain an optional `project_name`. `PATCH` semantics match `notes`: absent means unchanged, and `""` clears it.
- Spices: `ApplySynced` never reads or writes `project_name`.
- **Unedited rule:** when an update changes nothing but `project_name`, a nugget that was unedited stays so. In practice the update advances `source_synced_at` together with `updated_at` when they were equal before. Any other change in the same save is a normal edit.
- Search: `store_list.go`'s query adds `OR i.project_name LIKE ?`.

## 7. Tests

- **`internal/kimi`:** use an `httptest` fake kimi, never a real one. Cover the request shape (notes as `description`, `count: 5`, `client`, `avoid` passed through), mapping kimi's error codes to 502/503, health `ok` vs `degraded` vs unreachable, and cancellation when the caller's context ends.
- **`internal/httpapi`:** test the settings round trip and validation, `400` for blank notes, and the error passthrough.
- **`internal/idea`:**
  - `project_name` round-trips through create, patch and clear.
  - Search matches it.
  - A project-name-only update keeps a spices nugget unedited, and a subsequent `ApplySynced` refresh still updates its title and notes without touching the project name.
  - A title change in the same save marks the nugget edited.
- **Web** (vitest, jsdom):
  - The button's disabled and hint states (empty notes, unavailable).
  - Picking fills the field, and copies to an empty title only.
  - Re-roll sends the shown names in `avoid`.
  - Cancel aborts the request.
  - The card and page show the "Suggested project name:" line only when one is set.
  - The plan prompt gains the working-name line.

## 8. Out of scope

- A tone picker, choosing the count, or kimi's "more like this".
- Kimi's name check ("Taken?") and favourites.
- Generating names for nuggets in bulk, or automatically on capture.
- Using the project name in GitHub issues.
