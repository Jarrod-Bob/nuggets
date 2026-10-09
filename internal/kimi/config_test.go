package kimi

import (
	"context"
	"errors"
	"testing"
)

func TestLoadURLDefaultsToKimisAddress(t *testing.T) {
	got, err := LoadURL(context.Background(), newSettings(t))
	if err != nil || got != "http://127.0.0.1:7799" {
		t.Errorf("LoadURL = %q, %v; want http://127.0.0.1:7799", got, err)
	}
}

func TestSaveURLDropsTrailingSlash(t *testing.T) {
	store := newSettings(t)
	ctx := context.Background()
	saved, err := SaveURL(ctx, store, " https://kimi.local:7799/ ")
	if err != nil || saved != "https://kimi.local:7799" {
		t.Fatalf("SaveURL = %q, %v; want https://kimi.local:7799", saved, err)
	}
	if got, _ := LoadURL(ctx, store); got != "https://kimi.local:7799" {
		t.Errorf("LoadURL after save = %q", got)
	}
}

func TestSaveURLRejects(t *testing.T) {
	for _, raw := range []string{
		"",
		"127.0.0.1:7799",
		"ftp://127.0.0.1:7799",
		"http://",
		"/api/v1",
		"http://127.0.0.1:7799?x=1",
		"http://127.0.0.1:7799/?",
		"http://127.0.0.1:7799#top",
	} {
		store := newSettings(t)
		if _, err := SaveURL(context.Background(), store, raw); !errors.Is(err, ErrInvalidURL) {
			t.Errorf("SaveURL(%q) error = %v, want ErrInvalidURL", raw, err)
		}
		if got, _ := LoadURL(context.Background(), store); got != DefaultBaseURL {
			t.Errorf("SaveURL(%q) stored %q", raw, got)
		}
	}
}
