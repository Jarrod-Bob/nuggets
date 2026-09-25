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
		{
			name: "intentional spacing without hashtags is preserved",
			text: "Title\nStep 1:  mix\n    indented  code\tcol",
			want: ParsedMessage{Title: "Title", Notes: "Step 1:  mix\n    indented  code\tcol", Tags: []string{}},
		},
		{
			name: "spacing elsewhere survives a hashtag removal",
			text: "Title\nkeep  this  gap #tag and  this",
			want: ParsedMessage{Title: "Title", Notes: "keep  this  gap and  this", Tags: []string{"tag"}},
		},
		{
			name: "indentation survives a hashtag later on the line",
			text: "Title\n    indented #tag line\n  next",
			want: ParsedMessage{Title: "Title", Notes: "indented line\n  next", Tags: []string{"tag"}},
		},
		{
			name: "indentation on an inner notes line survives",
			text: "Title\nfirst\n    indented #tag line",
			want: ParsedMessage{Title: "Title", Notes: "first\n    indented line", Tags: []string{"tag"}},
		},
		{
			name: "consecutive hashtags mid line",
			text: "Ship #a #b the thing",
			want: ParsedMessage{Title: "Ship the thing", Notes: "", Tags: []string{"a", "b"}},
		},
		{
			name: "consecutive hashtags at end of a notes line",
			text: "Title\nline one #a #b\nline two",
			want: ParsedMessage{Title: "Title", Notes: "line one\nline two", Tags: []string{"a", "b"}},
		},
		{
			name: "hashtag at start of a notes line",
			text: "Title\n#tag   rest of line",
			want: ParsedMessage{Title: "Title", Notes: "rest of line", Tags: []string{"tag"}},
		},
		{
			name: "hashtag before punctuation",
			text: "Try #golang, then rust",
			want: ParsedMessage{Title: "Try, then rust", Notes: "", Tags: []string{"golang"}},
		},
		{
			name: "url fragment is not a hashtag",
			text: "Read this\nhttps://example.com/docs#install",
			want: ParsedMessage{Title: "Read this", Notes: "https://example.com/docs#install", Tags: []string{}},
		},
		{
			name: "hash inside a word is not a hashtag",
			text: "see issue#123 #bug",
			want: ParsedMessage{Title: "see issue#123", Notes: "", Tags: []string{"bug"}},
		},
		{
			name: "chained hashtags are both tags",
			text: "#go#rust",
			want: ParsedMessage{Title: "", Notes: "", Tags: []string{"go", "rust"}},
		},
		{
			name: "chained hashtags mid line are removed together",
			text: "Learn #go#rust today",
			want: ParsedMessage{Title: "Learn today", Notes: "", Tags: []string{"go", "rust"}},
		},
		{
			name: "hashtag after punctuation",
			text: "Plan (#work) today",
			want: ParsedMessage{Title: "Plan () today", Notes: "", Tags: []string{"work"}},
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
