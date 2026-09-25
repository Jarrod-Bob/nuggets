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

	cleaned := removeHashtags(text)

	lines := strings.SplitN(cleaned, "\n", 2)
	title := strings.TrimSpace(lines[0])
	notes := ""
	if len(lines) > 1 {
		notes = strings.TrimSpace(lines[1])
	}

	return ParsedMessage{Title: title, Notes: notes, Tags: tags}
}

// removeHashtags deletes every #hashtag from text, together with only the
// whitespace that deletion would otherwise leave dangling — one separator
// beside the tag, or the trailing gap when the tag ended its line. Every other
// run of spaces, tabs or indentation is the user's and is left exactly as sent.
func removeHashtags(text string) string {
	var out strings.Builder
	cursor := 0
	for _, m := range hashtagRe.FindAllStringIndex(text, -1) {
		start, end := m[0], m[1]
		out.WriteString(text[cursor:start])
		cursor = end

		built := out.String()
		atLineStart := built == "" || strings.HasSuffix(built, "\n")
		atLineEnd := end == len(text) || text[end] == '\n' || text[end] == '\r'

		switch {
		case atLineEnd:
			// Nothing follows on this line, so the gap before the tag is now
			// trailing whitespace.
			trimmed := strings.TrimRight(built, " \t")
			out.Reset()
			out.WriteString(trimmed)
		case isHorizontalSpace(text[end]):
			if atLineStart {
				// The tag opened the line: drop the gap after it so the line
				// starts at its first real word.
				for cursor < len(text) && isHorizontalSpace(text[cursor]) {
					cursor++
				}
			} else {
				cursor++ // drop the one separator the tag brought with it
			}
		default:
			// Punctuation follows ("#go, then"): drop the separator before the
			// tag so the punctuation rejoins the preceding word.
			if strings.HasSuffix(built, " ") || strings.HasSuffix(built, "\t") {
				out.Reset()
				out.WriteString(built[:len(built)-1])
			}
		}
	}
	out.WriteString(text[cursor:])
	return out.String()
}

func isHorizontalSpace(b byte) bool { return b == ' ' || b == '\t' }
