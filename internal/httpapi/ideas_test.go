package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Jarrod-Bob/nuggets/internal/db"
	"github.com/Jarrod-Bob/nuggets/internal/idea"
)

// ptr returns a pointer to v. idea.Draft's fields are pointers (absent means
// unchanged), so requests build them through this.
func ptr[T any](v T) *T { return &v }

func newTestServer(t *testing.T) http.Handler {
	t.Helper()
	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("opening test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	// A stub frontend handler, not nil: production (cmd/nuggets/main.go)
	// always wires a real embedded-frontend handler as the catch-all, so the
	// route table under test must match — otherwise tests asserting on the
	// catch-all's behavior (e.g. that /api/ 404s instead of falling through
	// to the SPA) would pass against a route table the shipped binary never
	// actually has.
	stubFrontend := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte("<html><body>stub spa</body></html>"))
	})
	return NewServer(idea.NewStore(database), stubFrontend)
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
		Title: ptr("Idea bank"), Notes: ptr("this one"), Tags: ptr([]string{"GO ", "saas"}),
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
	rec := do(t, srv, "POST", "/api/ideas", idea.Draft{Title: ptr("  ")})
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
	do(t, srv, "POST", "/api/ideas", idea.Draft{Title: ptr("Bin me")})

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

// TestWrongMethodReturnsAPIErrorNotSPA covers a request for a known resource
// path with an unsupported method. Go's ServeMux would give this 405 "for
// free" if /api/ideas were the only pattern in play — but once the /api/
// catch-all (registered to guard against exactly the bug this test used to
// certify away, see TestUnknownAPIPathReturns404NotSPA) is also a candidate
// match, ServeMux routes to the less-specific-but-still-matching catch-all
// instead of synthesizing a 405. What actually matters for this app is that
// the request never falls through to the SPA's index.html with a 200 — a
// JSON 404 from the catch-all satisfies that just as well as a 405 would.
func TestWrongMethodReturnsAPIErrorNotSPA(t *testing.T) {
	srv := newTestServer(t)
	rec := do(t, srv, "PUT", "/api/ideas", nil)
	if rec.Code == http.StatusOK {
		t.Fatalf("status = %d, want an error status, not 200 (would mean it fell through to the SPA)", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); strings.Contains(ct, "text/html") {
		t.Fatalf("Content-Type = %q, want JSON, not the SPA's HTML", ct)
	}
	var body errorBody
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding error body: %v; body = %s", err, rec.Body)
	}
	if body.Error.Message == "" {
		t.Errorf("expected a non-empty error message")
	}
}

// TestUnknownAPIPathReturns404NotSPA guards against unmatched /api/* requests
// silently falling through to the SPA catch-all and getting served
// index.html with a 200. With a real (even stub) frontend handler wired in,
// as production always does, this must 404 with the standard JSON error
// shape instead.
func TestUnknownAPIPathReturns404NotSPA(t *testing.T) {
	srv := newTestServer(t)
	rec := do(t, srv, "GET", "/api/bogus", nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); strings.Contains(ct, "text/html") {
		t.Fatalf("Content-Type = %q, want JSON, not the SPA's HTML", ct)
	}
	var body errorBody
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding error body: %v; body = %s", err, rec.Body)
	}
	if body.Error.Message == "" {
		t.Errorf("expected a non-empty error message")
	}
}

func TestUnknownStatusReturns400NotServerError(t *testing.T) {
	srv := newTestServer(t)
	do(t, srv, "POST", "/api/ideas", idea.Draft{Title: ptr("Real")})

	bogus := idea.Status("shipping")
	rec := do(t, srv, "PATCH", "/api/ideas/1", idea.Draft{Status: &bogus})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (a readable client error, not a 500)", rec.Code)
	}
	var body errorBody
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding error body: %v", err)
	}
	if body.Error.Message == "" {
		t.Errorf("expected a readable message")
	}
}

func TestDangerousLinkReturns400NotServerError(t *testing.T) {
	srv := newTestServer(t)
	rec := do(t, srv, "POST", "/api/ideas", idea.Draft{
		Title: ptr("Sneaky"),
		Links: ptr([]idea.Link{{URL: "javascript:alert(1)"}}),
	})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 for a javascript: link", rec.Code)
	}
	var body errorBody
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding error body: %v", err)
	}
	if body.Error.Message == "" {
		t.Errorf("expected a readable message")
	}
}

func TestLinksRoundTripThroughAPI(t *testing.T) {
	srv := newTestServer(t)
	rec := do(t, srv, "POST", "/api/ideas", idea.Draft{
		Title: ptr("Linked"),
		Links: ptr([]idea.Link{
			{URL: "https://github.com/x/y", Label: "repo"},
			{URL: "https://docs.example.com"},
		}),
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST status = %d, want 201; body = %s", rec.Code, rec.Body)
	}
	var created idea.Idea
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("decoding: %v", err)
	}
	if len(created.Links) != 2 || created.Links[0].URL != "https://github.com/x/y" {
		t.Errorf("Links = %v, want both, in order", created.Links)
	}
	if created.Status != idea.StatusRaw {
		t.Errorf("Status = %q, want raw by default", created.Status)
	}
}

// TestIdeaJSONMatchesGolden is the drift alarm on the TypeScript contract:
// rename a field here and this fails, reminding you to update web/src/api.ts.
func TestIdeaJSONMatchesGolden(t *testing.T) {
	sample := idea.Idea{
		ID: 1, Title: "Idea bank", Notes: "this one",
		Tags:   []string{"go", "saas"},
		Status: idea.StatusRaw,
		Links: []idea.Link{
			{URL: "https://github.com/example/repo", Label: "the repo"},
		},
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
