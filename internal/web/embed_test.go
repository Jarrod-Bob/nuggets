package web

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/Jarrod-Bob/nuggets/internal/db"
	"github.com/Jarrod-Bob/nuggets/internal/look"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

const indexHTML = `<!doctype html>
<html lang="en">
  <head><title>nuggets</title></head>
  <body><div id="root"></div></body>
</html>
`

const assetJS = "console.log('hi');\n"

func newHandler(t *testing.T) (http.Handler, *settings.Store) {
	t.Helper()
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("opening test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	store := settings.NewStore(database)
	files := fstest.MapFS{
		"index.html":    {Data: []byte(indexHTML)},
		"assets/app.js": {Data: []byte(assetJS)},
	}
	return Handler(files, store), store
}

func get(t *testing.T, h http.Handler, target string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", target, nil))
	return rec
}

func TestPagesAreStampedWithTheSavedLook(t *testing.T) {
	h, store := newHandler(t)
	if err := look.Save(t.Context(), store, look.Comic); err != nil {
		t.Fatal(err)
	}
	for _, target := range []string{"/", "/nuggets/12", "/bank/trash"} {
		rec := get(t, h, target)
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `<html data-look="comic" lang="en">`) {
			t.Errorf("GET %s = %d %q, want <html data-look=\"comic\">", target, rec.Code, rec.Body)
		}
	}
}

func TestPagesAreClassicByDefaultAndFollowTheSetting(t *testing.T) {
	h, store := newHandler(t)
	if body := get(t, h, "/").Body.String(); !strings.Contains(body, `data-look="classic"`) {
		t.Errorf("unset look: %q, want classic", body)
	}
	if err := look.Save(t.Context(), store, look.Comic); err != nil {
		t.Fatal(err)
	}
	if body := get(t, h, "/").Body.String(); !strings.Contains(body, `data-look="comic"`) {
		t.Errorf("after saving comic: %q, want comic (nothing cached)", body)
	}
}

func TestLookQueryOverridesOneResponseAndIsNeverSaved(t *testing.T) {
	h, store := newHandler(t)
	if body := get(t, h, "/?look=comic").Body.String(); !strings.Contains(body, `data-look="comic"`) {
		t.Errorf("?look=comic: %q", body)
	}
	if got, _ := look.Load(t.Context(), store); got != look.Classic {
		t.Errorf("saved look = %q, want classic untouched", got)
	}
	if err := look.Save(t.Context(), store, look.Comic); err != nil {
		t.Fatal(err)
	}
	if body := get(t, h, "/?look=classic").Body.String(); !strings.Contains(body, `data-look="classic"`) {
		t.Errorf("?look=classic: %q", body)
	}
	if body := get(t, h, "/?look=sepia").Body.String(); !strings.Contains(body, `data-look="comic"`) {
		t.Errorf("?look=sepia should be ignored: %q", body)
	}
	if got, _ := look.Load(t.Context(), store); got != look.Comic {
		t.Errorf("saved look = %q, want comic untouched", got)
	}
}

func TestAssetsAreServedUnchanged(t *testing.T) {
	h, _ := newHandler(t)
	rec := get(t, h, "/assets/app.js?look=comic")
	if rec.Code != http.StatusOK || rec.Body.String() != assetJS {
		t.Errorf("asset = %d %q, want it byte-for-byte", rec.Code, rec.Body)
	}
}
