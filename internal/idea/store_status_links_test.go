package idea

import (
	"context"
	"errors"
	"testing"
)

func TestCreateDefaultsStatusToRaw(t *testing.T) {
	store := newTestStore(t)
	created, err := store.Create(context.Background(), Draft{Title: ptr("Fresh")})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if created.Status != StatusRaw {
		t.Errorf("Status = %q, want raw for a new nugget", created.Status)
	}
}

func TestParseStatusRejectsUnknown(t *testing.T) {
	for _, ok := range []string{"raw", "exploring", "building", "parked", "killed"} {
		if _, err := ParseStatus(ok); err != nil {
			t.Errorf("ParseStatus(%q) error = %v, want nil", ok, err)
		}
	}
	for _, bad := range []string{"", "RAW", "shipping", "done", "raw "} {
		if _, err := ParseStatus(bad); !errors.Is(err, ErrInvalidStatus) {
			t.Errorf("ParseStatus(%q) error = %v, want ErrInvalidStatus", bad, err)
		}
	}
}

func TestCreateRejectsUnknownStatus(t *testing.T) {
	store := newTestStore(t)
	bogus := Status("shipping")
	_, err := store.Create(context.Background(), Draft{Title: ptr("Bad status"), Status: &bogus})
	if !errors.Is(err, ErrInvalidStatus) {
		t.Errorf("Create() error = %v, want ErrInvalidStatus", err)
	}
}

func TestLinkValidationRejectsDangerousSchemes(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	bad := []string{
		"javascript:alert(1)",
		"data:text/html,<script>alert(1)</script>",
		"vbscript:msgbox(1)",
		"ftp://example.com/file",
		"example.com/no-scheme",
		"/relative/path",
		"http://", // empty host
		"https://",
		"",
	}
	for _, url := range bad {
		_, err := store.Create(ctx, Draft{
			Title: ptr("With a link"),
			Links: ptr([]Link{{URL: url}}),
		})
		if !errors.Is(err, ErrInvalidLink) {
			t.Errorf("Create(link=%q) error = %v, want ErrInvalidLink", url, err)
		}
	}
}

func TestLinkValidationAcceptsHTTPAndHTTPS(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, err := store.Create(ctx, Draft{
		Title: ptr("Good links"),
		Links: ptr([]Link{
			{URL: "http://example.com", Label: "plain"},
			{URL: "https://github.com/x/y", Label: "repo"},
		}),
	})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if len(created.Links) != 2 {
		t.Fatalf("Links = %v, want 2", created.Links)
	}
}

func TestLinkOrderingSurvivesRoundTrip(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	want := []Link{
		{URL: "https://a.example.com", Label: "first"},
		{URL: "https://b.example.com", Label: "second"},
		{URL: "https://c.example.com", Label: "third"},
	}
	created, err := store.Create(ctx, Draft{Title: ptr("Ordered"), Links: ptr(want)})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	got, err := store.Get(ctx, created.ID)
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if len(got.Links) != len(want) {
		t.Fatalf("Links = %v, want %v", got.Links, want)
	}
	for i := range want {
		if got.Links[i].URL != want[i].URL || got.Links[i].Label != want[i].Label {
			t.Errorf("Links[%d] = %+v, want %+v", i, got.Links[i], want[i])
		}
	}
}

func TestUpdateReplacesLinkSet(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, _ := store.Create(ctx, Draft{
		Title: ptr("Has links"),
		Links: ptr([]Link{{URL: "https://old.example.com"}}),
	})
	updated, err := store.Update(ctx, created.ID, Draft{
		Links: ptr([]Link{{URL: "https://new.example.com", Label: "new"}}),
	})
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	if len(updated.Links) != 1 || updated.Links[0].URL != "https://new.example.com" {
		t.Errorf("Links = %v, want only the new one (save replaces the set)", updated.Links)
	}
}

func TestUpdateEmptyLinkArrayClearsThem(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, _ := store.Create(ctx, Draft{
		Title: ptr("Has links"),
		Links: ptr([]Link{{URL: "https://x.example.com"}}),
	})
	updated, err := store.Update(ctx, created.ID, Draft{Links: ptr([]Link{})})
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	if len(updated.Links) != 0 {
		t.Errorf("Links = %v, want empty", updated.Links)
	}
}

func TestBlankLabelIsStoredAsEmpty(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()

	created, err := store.Create(ctx, Draft{
		Title: ptr("Bare link"),
		Links: ptr([]Link{{URL: "https://example.com"}}),
	})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if created.Links[0].Label != "" {
		t.Errorf("Label = %q, want empty (the host is rendered client-side)", created.Links[0].Label)
	}
}
