package telegram

import (
	"regexp"
	"strings"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
)

// hashtagRe finds #hashtags in the message text using Go's UTF-8 strings
// directly. Telegram's own `entities` offsets are UTF-16 code units, which
// silently mis-slice a UTF-8 Go string the moment the message contains an
// emoji or any other non-BMP character — the regex sidesteps that conversion
// entirely (design §7). Like Telegram, a # only starts a hashtag at the start
// of the text or after a non-word character, so a URL fragment
// (docs#install) or a word like issue#123 is left alone. RE2 has no
// lookbehind, so the preceding character is matched too and group 1 is the
// hashtag itself.
var hashtagRe = regexp.MustCompile(`(?:^|[^\p{L}\p{N}_])(#[\p{L}\p{N}_]+)`)

// hashtagSpans returns the [start, end) byte offsets of each hashtag in text,
// '#' included.
func hashtagSpans(text string) [][2]int {
	var spans [][2]int
	for _, m := range hashtagRe.FindAllStringSubmatchIndex(text, -1) {
		spans = append(spans, [2]int{m[2], m[3]})
	}
	return spans
}

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
//   - Tags are #hashtags found anywhere in the text (see hashtagRe), normalized, and removed
//     from the text they were found in before title/notes are split out.
//
// An empty Title (after hashtag removal and trimming) means the caller
// should skip the message, matching idea.ErrEmptyTitle in the store.
func ParseMessage(text string) ParsedMessage {
	spans := hashtagSpans(text)
	tags := make([]string, 0, len(spans))
	for _, sp := range spans {
		tags = append(tags, idea.NormalizeTag(text[sp[0]+1:sp[1]]))
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
	for _, sp := range hashtagSpans(text) {
		start, end := sp[0], sp[1]
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
