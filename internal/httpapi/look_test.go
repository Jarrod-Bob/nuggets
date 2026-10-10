package httpapi

import (
	"net/http"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Jarrod-Bob/nuggets/internal/db"
	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

func newLookEnv(t *testing.T) (http.Handler, *settings.Store) {
	t.Helper()
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("opening test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	store := settings.NewStore(database)
	return NewServer(idea.NewStore(database), store, nil, nil, nil, nil, nil, nil), store
}

func TestLookIsClassicUntilChosen(t *testing.T) {
	srv, _ := newLookEnv(t)
	rec := do(t, srv, "GET", "/api/settings/look", nil)
	if rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != `{"look":"classic"}` {
		t.Errorf("GET = %d %s, want classic", rec.Code, rec.Body)
	}
}

func TestLookRoundTrip(t *testing.T) {
	srv, _ := newLookEnv(t)
	rec := do(t, srv, "PUT", "/api/settings/look", map[string]any{"look": "comic"})
	if rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != `{"look":"comic"}` {
		t.Fatalf("PUT = %d %s", rec.Code, rec.Body)
	}
	rec = do(t, srv, "GET", "/api/settings/look", nil)
	if strings.TrimSpace(rec.Body.String()) != `{"look":"comic"}` {
		t.Errorf("GET = %d %s, want comic", rec.Code, rec.Body)
	}
}

func TestLookUnrecognisedStoredValueReadsAsClassic(t *testing.T) {
	srv, store := newLookEnv(t)
	if err := store.Set(t.Context(), "look", "sepia"); err != nil {
		t.Fatal(err)
	}
	rec := do(t, srv, "GET", "/api/settings/look", nil)
	if strings.TrimSpace(rec.Body.String()) != `{"look":"classic"}` {
		t.Errorf("GET = %d %s, want classic", rec.Code, rec.Body)
	}
}

func TestLookRejectsABadValue(t *testing.T) {
	srv, _ := newLookEnv(t)
	do(t, srv, "PUT", "/api/settings/look", map[string]any{"look": "comic"})
	rec := do(t, srv, "PUT", "/api/settings/look", map[string]any{"look": "sepia"})
	if rec.Code != http.StatusBadRequest {
		t.Errorf("PUT = %d %s, want 400", rec.Code, rec.Body)
	}
	if got := do(t, srv, "GET", "/api/settings/look", nil); strings.TrimSpace(got.Body.String()) != `{"look":"comic"}` {
		t.Errorf("GET after bad PUT = %s, want comic kept", got.Body)
	}
}
