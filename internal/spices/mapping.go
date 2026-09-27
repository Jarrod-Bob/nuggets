package spices

import (
	"strconv"
	"strings"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
)

// ToSynced maps a spices idea onto a nugget (design §4, spices design §7):
// fields.title is the title, fields.description the notes, tags the tags.
// When the form has no title — an item saved before spices had fields, whose
// fields is {} — the raw text stands in: its first non-blank line is the
// title and the lines after it are the notes, unless a description exists.
func ToSynced(item Item) idea.SyncedItem {
	title := strings.TrimSpace(item.Field("title"))
	notes := item.Field("description")

	if title == "" {
		textTitle, textNotes := splitText(item.Text)
		title = textTitle
		if strings.TrimSpace(notes) == "" {
			notes = textNotes
		}
	}

	return idea.SyncedItem{
		Ref:       strconv.FormatInt(item.ID, 10),
		Rev:       item.Rev,
		Title:     title,
		Notes:     notes,
		Tags:      item.Tags,
		DeletedAt: item.DeletedAt,
	}
}

// splitText splits raw text into its first non-blank line and everything
// after it, with the blank lines around the rest dropped but its own line
// breaks and indentation kept.
func splitText(text string) (title, rest string) {
	lines := strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n")
	for i, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		title = strings.TrimSpace(line)
		rest = strings.Trim(strings.Join(lines[i+1:], "\n"), "\n")
		if strings.TrimSpace(rest) == "" {
			rest = ""
		}
		return title, rest
	}
	return "", ""
}
