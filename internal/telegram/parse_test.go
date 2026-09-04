package telegram

import (
	"reflect"
	"testing"
)

func TestParseMessage(t *testing.T) {
	cases := []struct {
		name string
		text string
		want ParsedMessage
	}{
		{
			name: "single line",
			text: "Buy oat milk",
			want: ParsedMessage{Title: "Buy oat milk", Notes: "", Tags: []string{}},
		},
		{
			name: "multi line",
			text: "Buy oat milk\nAlso get the good coffee beans",
			want: ParsedMessage{Title: "Buy oat milk", Notes: "Also get the good coffee beans", Tags: []string{}},
		},
		{
			name: "multi line multi paragraph notes",
			text: "Title here\n\nFirst paragraph.\n\nSecond paragraph.",
			want: ParsedMessage{Title: "Title here", Notes: "First paragraph.\n\nSecond paragraph.", Tags: []string{}},
		},
		{
			name: "hashtag at end",
			text: "Ship the thing #work",
			want: ParsedMessage{Title: "Ship the thing", Notes: "", Tags: []string{"work"}},
		},
		{
			name: "hashtag in the middle",
			text: "Ship #work the thing",
			want: ParsedMessage{Title: "Ship the thing", Notes: "", Tags: []string{"work"}},
		},
		{
			name: "hashtag at start",
			text: "#idea a whole new app",
			want: ParsedMessage{Title: "a whole new app", Notes: "", Tags: []string{"idea"}},
		},
		{
			name: "hashtags only",
			text: "#work #idea",
			want: ParsedMessage{Title: "", Notes: "", Tags: []string{"work", "idea"}},
		},
		{
			name: "hashtags in notes",
			text: "Title\nNotes with a #tag inside them",
			want: ParsedMessage{Title: "Title", Notes: "Notes with a inside them", Tags: []string{"tag"}},
		},
		{
			name: "emoji before hashtag: the UTF-16 trap",
			text: "🎉 launch day #celebrate",
			want: ParsedMessage{Title: "🎉 launch day", Notes: "", Tags: []string{"celebrate"}},
		},
		{
			name: "empty after trimming",
			text: "   ",
			want: ParsedMessage{Title: "", Notes: "", Tags: []string{}},
		},
		{
			name: "whitespace only with newline",
			text: "  \n  ",
			want: ParsedMessage{Title: "", Notes: "", Tags: []string{}},
		},
		{
			name: "hashtag normalized to lowercase",
			text: "Big idea #ShipIt",
			want: ParsedMessage{Title: "Big idea", Notes: "", Tags: []string{"shipit"}},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ParseMessage(tc.text)
			if got.Title != tc.want.Title {
				t.Errorf("Title = %q, want %q", got.Title, tc.want.Title)
			}
			if got.Notes != tc.want.Notes {
				t.Errorf("Notes = %q, want %q", got.Notes, tc.want.Notes)
			}
			if len(got.Tags) == 0 {
				got.Tags = []string{}
			}
			if !reflect.DeepEqual(got.Tags, tc.want.Tags) {
				t.Errorf("Tags = %v, want %v", got.Tags, tc.want.Tags)
			}
		})
	}
}
