package github

import (
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
)

// TitlePrefix matches .github/ISSUE_TEMPLATE/feature_request.md's title.
const TitlePrefix = "[Feature]: "

// maxTitleLength is GitHub's limit on an issue title, in characters.
const maxTitleLength = 256

// Labels is what every feature request is labelled, as the template does.
var Labels = []string{"enhancement"}

// Marker is the hidden comment that identifies a row's issue on GitHub, so a
// retry can find an issue whose creation it never heard about.
func Marker(ideaID int64, key string) string {
	return fmt.Sprintf("<!-- nuggets:nugget-id=%d key=%s -->", ideaID, key)
}

// Title is the issue title for a nugget, cut to GitHub's limit.
func Title(n *idea.Idea) string {
	title := TitlePrefix + strings.TrimSpace(n.Title)
	if utf8.RuneCountInString(title) <= maxTitleLength {
		return title
	}
	runes := []rune(title)
	return string(runes[:maxTitleLength-1]) + "…"
}

// Body is the issue body for a nugget, following the feature-request
// template's sections (design §6). It holds only what the nugget itself
// says plus the marker: no local URL, links or anything from settings.
func Body(n *idea.Idea, marker string) string {
	var b strings.Builder
	b.WriteString("## Problem\n")
	b.WriteString("Captured as an idea in nuggets; the problem it solves hasn't been written up yet.\n\n")

	b.WriteString("## Proposed Solution\n")
	if notes := strings.TrimSpace(n.Notes); notes != "" {
		b.WriteString(notes)
	} else {
		b.WriteString("_No notes were captured with this idea._")
	}
	b.WriteString("\n\n")

	b.WriteString("## Alternatives Considered\n")
	b.WriteString("_None noted._\n\n")

	b.WriteString("## Additional Context\n")
	tags := make([]string, 0, len(n.Tags))
	for _, t := range n.Tags {
		tags = append(tags, "`"+strings.ReplaceAll(t, "`", "'")+"`")
	}
	if len(tags) == 0 {
		tags = append(tags, "none")
	}
	fmt.Fprintf(&b, "- **Tags:** %s\n", strings.Join(tags, ", "))
	fmt.Fprintf(&b, "- **Origin:** %s\n", origin(n))
	fmt.Fprintf(&b, "- **Captured:** %s\n", n.CreatedAt.UTC().Format("2006-01-02"))
	b.WriteString("\n")
	b.WriteString(marker)
	b.WriteString("\n")
	return b.String()
}

// origin names where the nugget came from: spices (and so Telegram), the
// retired Telegram bot, or typed into nuggets.
func origin(n *idea.Idea) string {
	if n.Source == nil {
		return "manual (typed into nuggets)"
	}
	switch *n.Source {
	case idea.SourceSpices, idea.SourceSpicesDetached:
		return "spices (captured via Telegram)"
	default:
		return idea.OriginLabel(*n.Source)
	}
}
