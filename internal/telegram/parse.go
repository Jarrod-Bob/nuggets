package telegram

import (
	"regexp"
	"strings"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
)

// hashtagRe finds #hashtags anywhere in the message text using Go's UTF-8
// strings directly. Telegram's own `entities` offsets are UTF-16 code units,
// which silently mis-slice a UTF-8 Go string the moment the message contains
// an emoji or any other non-BMP character — the regex sidesteps that
// conversion entirely (design §7).
var hashtagRe = regexp.MustCompile(`#[\p{L}\p{N}_]+`)

// squeezeSpaces collapses runs of horizontal whitespace left behind by
// removing a hashtag from the middle of a line. Newlines are untouched, so
// intentional paragraph breaks in notes survive.
var squeezeSpaces = regexp.MustCompile(`[ \t]{2,}`)

// ParsedMessage is a Telegram message text broken into a nugget's parts,
// per design §7.
type ParsedMessage struct {
	Title string
	Notes string
	Tags  []string
}

// ParseMessage turns raw Telegram message text into a nugget draft.
//
//   - Title is the first line, trimmed. A single-line message has that line
//     as the title and empty notes.
//   - Notes is everything after the first newline, trimmed.
//   - Tags are #hashtags found anywhere in the text, normalized, and removed
//     from the text they were found in before title/notes are split out.
//
// An empty Title (after hashtag removal and trimming) means the caller
// should skip the message, matching idea.ErrEmptyTitle in the store.
func ParseMessage(text string) ParsedMessage {
	matches := hashtagRe.FindAllString(text, -1)
	tags := make([]string, 0, len(matches))
	for _, m := range matches {
		tags = append(tags, idea.NormalizeTag(strings.TrimPrefix(m, "#")))
	}

	cleaned := hashtagRe.ReplaceAllString(text, "")
	cleaned = squeezeSpaces.ReplaceAllString(cleaned, " ")

	lines := strings.SplitN(cleaned, "\n", 2)
	title := strings.TrimSpace(lines[0])
	notes := ""
	if len(lines) > 1 {
		notes = strings.TrimSpace(lines[1])
	}

	return ParsedMessage{Title: title, Notes: notes, Tags: tags}
}
