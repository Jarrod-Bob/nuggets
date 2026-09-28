package github

import (
	"context"
	"strings"
	"testing"

	"github.com/Jarrod-Bob/nuggets/internal/idea"
)

func TestValidateMappingsNormalizes(t *testing.T) {
	got, err := ValidateMappings([]Mapping{
		{Tag: " #Nuggets ", Repo: " Jarrod-Bob/nuggets "},
		{Tag: "side project", Repo: "some-org/repo.name_2"},
	})
	if err != nil {
		t.Fatal(err)
	}
	want := []Mapping{{Tag: "nuggets", Repo: "Jarrod-Bob/nuggets"}, {Tag: "side project", Repo: "some-org/repo.name_2"}}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Errorf("ValidateMappings = %+v, want %+v", got, want)
	}
	if got, err := ValidateMappings(nil); err != nil || len(got) != 0 {
		t.Errorf("an empty mapping = %v, %v; want allowed", got, err)
	}
}

func TestValidateMappingsRejects(t *testing.T) {
	cases := map[string]Mapping{
		"empty tag":         {Tag: " ", Repo: "Jarrod-Bob/nuggets"},
		"only a hash":       {Tag: "#", Repo: "Jarrod-Bob/nuggets"},
		"comma":             {Tag: "a,b", Repo: "Jarrod-Bob/nuggets"},
		"control character": {Tag: "a\tb", Repo: "Jarrod-Bob/nuggets"},
		"long tag":          {Tag: strings.Repeat("x", 65), Repo: "Jarrod-Bob/nuggets"},
		"no slash":          {Tag: "x", Repo: "nuggets"},
		"extra segment":     {Tag: "x", Repo: "Jarrod-Bob/nuggets/issues"},
		"a URL":             {Tag: "x", Repo: "https://github.com/Jarrod-Bob/nuggets"},
		"leading hyphen":    {Tag: "x", Repo: "-bob/nuggets"},
		"double hyphen":     {Tag: "x", Repo: "a--b/nuggets"},
		"long owner":        {Tag: "x", Repo: strings.Repeat("a", 40) + "/r"},
		"dot-dot":           {Tag: "x", Repo: "bob/.."},
		"space in repo":     {Tag: "x", Repo: "bob/my repo"},
		"empty repo":        {Tag: "x", Repo: "bob/"},
	}
	for name, m := range cases {
		if _, err := ValidateMappings([]Mapping{m}); err == nil {
			t.Errorf("%s: %+v was accepted", name, m)
		}
	}
	if _, err := ValidateMappings([]Mapping{{Tag: "x", Repo: "a/b"}, {Tag: "#X", Repo: "c/d"}}); err == nil {
		t.Error("a tag mapped twice was accepted")
	}
}

func TestLoadConfigDefaultsTheMapping(t *testing.T) {
	e := newTestEnv(t)
	ctx := context.Background()
	cfg, err := LoadConfig(ctx, e.settings)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Connected || len(cfg.Mappings) != 1 || cfg.Mappings[0] != DefaultMappings()[0] {
		t.Errorf("fresh config = %+v, want not connected with the default mapping", cfg)
	}
	if err := e.settings.Set(ctx, KeyMappings, `[]`); err != nil {
		t.Fatal(err)
	}
	if cfg, _ := LoadConfig(ctx, e.settings); len(cfg.Mappings) != 0 {
		t.Errorf("a saved empty mapping loaded as %+v", cfg.Mappings)
	}
}

func TestTitleIsCutToGitHubsLimit(t *testing.T) {
	long := strings.Repeat("é", 300)
	got := Title(&idea.Idea{Title: long})
	if n := len([]rune(got)); n != maxTitleLength {
		t.Errorf("title is %d characters, want %d", n, maxTitleLength)
	}
	if !strings.HasPrefix(got, TitlePrefix) {
		t.Errorf("title %q lost its prefix", got)
	}
}

func TestBodyNamesTheOrigin(t *testing.T) {
	spices := idea.SourceSpices
	body := Body(&idea.Idea{Title: "t", Source: &spices, Tags: []string{}}, "<!-- m -->")
	for _, want := range []string{"- **Origin:** spices (captured via Telegram)", "- **Tags:** none", "_No notes were captured with this idea._"} {
		if !strings.Contains(body, want) {
			t.Errorf("body is missing %q:\n%s", want, body)
		}
	}
}
