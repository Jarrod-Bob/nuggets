package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/Jarrod-Bob/nuggets/internal/db"
	"github.com/Jarrod-Bob/nuggets/internal/idea"
)

func newTestServer(t *testing.T) http.Handler {
	t.Helper()
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("opening test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	return NewServer(idea.NewStore(database), nil)
}

func do(t *testing.T, srv http.Handler, method, target string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var reader *bytes.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshalling body: %v", err)
		}
		reader = bytes.NewReader(encoded)
	} else {
		reader = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, target, reader)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	return rec
}

func TestCreateThenListRoundTrip(t *testing.T) {
	srv := newTestServer(t)

	rec := do(t, srv, "POST", "/api/ideas", idea.Draft{
		Title: "Idea bank", Notes: "this one", Tags: []string{"GO ", "saas"},
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST status = %d, want 201; body = %s", rec.Code, rec.Body)
	}

	var created idea.Idea
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("decoding create response: %v", err)
	}
	if len(created.Tags) != 2 || created.Tags[0] != "go" {
		t.Errorf("Tags = %v, want normalized [go saas]", created.Tags)
	}

	rec = do(t, srv, "GET", "/api/ideas", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET status = %d, want 200", rec.Code)
	}
	var listed []idea.Idea
	if err := json.Unmarshal(rec.Body.Bytes(), &listed); err != nil {
		t.Fatalf("decoding list: %v", err)
	}
	if len(listed) != 1 {
		t.Errorf("listed %d ideas, want 1", len(listed))
	}
}

func TestCreateBlankTitleReturns400WithMessage(t *testing.T) {
	srv := newTestServer(t)
	rec := do(t, srv, "POST", "/api/ideas", idea.Draft{Title: "  "})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	var body errorBody
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding error body: %v", err)
	}
	if body.Error.Message != "A nugget needs a title." {
		t.Errorf("message = %q, want the design system's copy", body.Error.Message)
	}
}

func TestEmptyListSerializesAsArrayNotNull(t *testing.T) {
	srv := newTestServer(t)
	rec := do(t, srv, "GET", "/api/ideas", nil)
	if got := bytes.TrimSpace(rec.Body.Bytes()); string(got) != "[]" {
		t.Errorf("body = %s, want [] — null would break the frontend's .map()", got)
	}
}

func TestArchiveRemovesFromActiveListAndAddsToTrash(t *testing.T) {
	srv := newTestServer(t)
	do(t, srv, "POST", "/api/ideas", idea.Draft{Title: "Bin me"})

	if rec := do(t, srv, "POST", "/api/ideas/1/archive", nil); rec.Code != http.StatusNoContent {
		t.Fatalf("archive status = %d, want 204", rec.Code)
	}

	var active []idea.Idea
	json.Unmarshal(do(t, srv, "GET", "/api/ideas", nil).Body.Bytes(), &active)
	if len(active) != 0 {
		t.Errorf("active = %d, want 0", len(active))
	}

	var trash []idea.Idea
	json.Unmarshal(do(t, srv, "GET", "/api/ideas?archived=true", nil).Body.Bytes(), &trash)
	if len(trash) != 1 {
		t.Errorf("trash = %d, want 1", len(trash))
	}
}

func TestUnknownIdeaReturns404(t *testing.T) {
	srv := newTestServer(t)
	if rec := do(t, srv, "GET", "/api/ideas/999", nil); rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestWrongMethodReturns405(t *testing.T) {
	srv := newTestServer(t)
	if rec := do(t, srv, "PUT", "/api/ideas", nil); rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want 405 (ServeMux gives this free)", rec.Code)
	}
}

// TestIdeaJSONMatchesGolden is the drift alarm on the TypeScript contract:
// rename a field here and this fails, reminding you to update web/src/api.ts.
func TestIdeaJSONMatchesGolden(t *testing.T) {
	sample := idea.Idea{
		ID: 1, Title: "Idea bank", Notes: "this one",
		Tags: []string{"go", "saas"},
	}
	encoded, err := json.MarshalIndent(sample, "", "  ")
	if err != nil {
		t.Fatalf("marshalling: %v", err)
	}

	goldenPath := filepath.Join("testdata", "idea.golden.json")
	if os.Getenv("UPDATE_GOLDEN") == "1" {
		if err := os.WriteFile(goldenPath, encoded, 0o644); err != nil {
			t.Fatalf("writing golden: %v", err)
		}
	}
	want, err := os.ReadFile(goldenPath)
	if err != nil {
		t.Fatalf("reading golden (run with UPDATE_GOLDEN=1 to create): %v", err)
	}
	if string(bytes.TrimSpace(want)) != string(bytes.TrimSpace(encoded)) {
		t.Errorf("Idea JSON changed.\n got: %s\nwant: %s\n\nUpdate web/src/api.ts to match, then rerun with UPDATE_GOLDEN=1.", encoded, want)
	}
}
