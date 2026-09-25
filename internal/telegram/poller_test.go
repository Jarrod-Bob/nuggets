package telegram

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/db"
	"github.com/Jarrod-Bob/nuggets/internal/idea"
	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// fakeTelegram is a minimal in-memory Telegram double. getUpdates hands back
// one queued batch per call (further calls get an empty batch), so a test can
// script exactly what the poller sees across successive Drain calls.
type fakeTelegram struct {
	mu         sync.Mutex
	batches    [][]Update
	getCalls   int
	sent       []string // texts passed to sendMessage, in order
	failStatus int      // if nonzero, every getUpdates call fails with this status
	// onSend, if set, runs before each sendMessage is answered, outside mu.
	onSend func()
}

func (f *fakeTelegram) server() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if f.onSend != nil && strings.HasSuffix(r.URL.Path, "/sendMessage") {
			f.onSend()
		}
		f.mu.Lock()
		defer f.mu.Unlock()
		switch {
		case strings.HasSuffix(r.URL.Path, "/getUpdates"):
			f.getCalls++
			if f.failStatus != 0 {
				w.WriteHeader(f.failStatus)
				json.NewEncoder(w).Encode(map[string]any{"ok": false, "description": "boom"})
				return
			}
			var result []Update
			if f.getCalls-1 < len(f.batches) {
				result = f.batches[f.getCalls-1]
			}
			json.NewEncoder(w).Encode(map[string]any{"ok": true, "result": result})
		case strings.HasSuffix(r.URL.Path, "/sendMessage"):
			f.sent = append(f.sent, r.URL.Query().Get("text"))
			json.NewEncoder(w).Encode(map[string]any{"ok": true, "result": map[string]any{}})
		case strings.HasSuffix(r.URL.Path, "/getMe"):
			json.NewEncoder(w).Encode(map[string]any{"ok": true, "result": User{Username: "testbot"}})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

func newTestPoller(t *testing.T, fake *fakeTelegram, opts ...Option) (*Poller, *settings.Store, *idea.Store) {
	t.Helper()
	srv := fake.server()
	t.Cleanup(srv.Close)

	database, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("opening test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	settingsStore := settings.NewStore(database)
	ideaStore := idea.NewStore(database)
	poller := NewPoller(ideaStore, settingsStore, append([]Option{
		WithBaseURL(func(string) string { return srv.URL }),
		WithHTTPClient(srv.Client()),
		WithBackoff(time.Millisecond, 20*time.Millisecond),
	}, opts...)...)
	return poller, settingsStore, ideaStore
}

func mustSetToken(t *testing.T, ctx context.Context, s *settings.Store) {
	t.Helper()
	if err := s.Set(ctx, KeyToken, "test-token"); err != nil {
		t.Fatalf("setting token: %v", err)
	}
}

func mustPair(t *testing.T, ctx context.Context, s *settings.Store, chatID int64) {
	t.Helper()
	if err := s.Set(ctx, KeyChatID, strconv.FormatInt(chatID, 10)); err != nil {
		t.Fatalf("pairing chat: %v", err)
	}
}

func TestDrainWithNoTokenIsIdleNotError(t *testing.T) {
	fake := &fakeTelegram{}
	poller, _, ideaStore := newTestPoller(t, fake)

	if err := poller.Drain(context.Background()); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("Drain with no token = %v, want ErrNotConfigured", err)
	}
	if fake.getCalls != 0 {
		t.Errorf("getUpdates called %d times, want 0 — no token means idle", fake.getCalls)
	}
	ideas, err := ideaStore.List(context.Background(), idea.ListFilter{})
	if err != nil {
		t.Fatalf("listing: %v", err)
	}
	if len(ideas) != 0 {
		t.Errorf("ideas = %d, want 0", len(ideas))
	}
}

func TestDrainImportsTextMessageFromOwner(t *testing.T) {
	ctx := context.Background()
	fake := &fakeTelegram{batches: [][]Update{
		{{UpdateID: 10, Message: &Message{MessageID: 1, Chat: Chat{ID: 555}, Text: "Buy oat milk\n\nGet the good kind #errand"}}},
	}}
	poller, settingsStore, ideaStore := newTestPoller(t, fake)
	mustSetToken(t, ctx, settingsStore)
	mustPair(t, ctx, settingsStore, 555)

	if err := poller.Drain(ctx); err != nil {
		t.Fatalf("Drain: %v", err)
	}

	ideas, err := ideaStore.List(ctx, idea.ListFilter{})
	if err != nil {
		t.Fatalf("listing: %v", err)
	}
	if len(ideas) != 1 {
		t.Fatalf("ideas = %d, want 1", len(ideas))
	}
	got := ideas[0]
	if got.Title != "Buy oat milk" {
		t.Errorf("Title = %q, want %q", got.Title, "Buy oat milk")
	}
	if got.Notes != "Get the good kind" {
		t.Errorf("Notes = %q, want %q", got.Notes, "Get the good kind")
	}
	if len(got.Tags) != 1 || got.Tags[0] != "errand" {
		t.Errorf("Tags = %v, want [errand]", got.Tags)
	}
	if got.Source == nil || *got.Source != SourceTelegram {
		t.Errorf("Source = %v, want %q", got.Source, SourceTelegram)
	}
	if got.SourceRef == nil || *got.SourceRef != "1" {
		t.Errorf("SourceRef = %v, want %q", got.SourceRef, "1")
	}

	offset, ok, err := settingsStore.Get(ctx, KeyOffset)
	if err != nil || !ok {
		t.Fatalf("offset not stored: ok=%v err=%v", ok, err)
	}
	if offset != "11" {
		t.Errorf("offset = %q, want %q (last update_id + 1)", offset, "11")
	}

	if len(fake.sent) != 1 || !strings.Contains(fake.sent[0], "Buy oat milk") {
		t.Errorf("sent replies = %v, want one confirming the title", fake.sent)
	}
}

func TestDrainDropsMessageFromWrongChatButAdvancesOffset(t *testing.T) {
	ctx := context.Background()
	fake := &fakeTelegram{batches: [][]Update{
		{{UpdateID: 20, Message: &Message{MessageID: 1, Chat: Chat{ID: 999}, Text: "an intruder's idea"}}},
	}}
	poller, settingsStore, ideaStore := newTestPoller(t, fake)
	mustSetToken(t, ctx, settingsStore)
	mustPair(t, ctx, settingsStore, 555) // owner is 555, message is from 999

	if err := poller.Drain(ctx); err != nil {
		t.Fatalf("Drain: %v", err)
	}

	ideas, _ := ideaStore.List(ctx, idea.ListFilter{})
	if len(ideas) != 0 {
		t.Errorf("ideas = %d, want 0 — wrong chat must never import", len(ideas))
	}
	offset, _, _ := settingsStore.Get(ctx, KeyOffset)
	if offset != "21" {
		t.Errorf("offset = %q, want %q — a dropped message must still advance the position", offset, "21")
	}
	if len(fake.sent) != 0 {
		t.Errorf("sent = %v, want no reply to a stranger", fake.sent)
	}
}

func TestDrainSkipsNonTextMessageWithReplyAndAdvancesOffset(t *testing.T) {
	ctx := context.Background()
	fake := &fakeTelegram{batches: [][]Update{
		{{UpdateID: 30, Message: &Message{MessageID: 1, Chat: Chat{ID: 555}, Text: ""}}},
	}}
	poller, settingsStore, ideaStore := newTestPoller(t, fake)
	mustSetToken(t, ctx, settingsStore)
	mustPair(t, ctx, settingsStore, 555)

	if err := poller.Drain(ctx); err != nil {
		t.Fatalf("Drain: %v", err)
	}

	ideas, _ := ideaStore.List(ctx, idea.ListFilter{})
	if len(ideas) != 0 {
		t.Errorf("ideas = %d, want 0", len(ideas))
	}
	offset, _, _ := settingsStore.Get(ctx, KeyOffset)
	if offset != "31" {
		t.Errorf("offset = %q, want %q", offset, "31")
	}
	if len(fake.sent) != 1 || fake.sent[0] != "text only for now" {
		t.Errorf("sent = %v, want a single \"text only for now\" reply", fake.sent)
	}
}

func TestDrainSkipsMalformedEmptyTitleAndAdvancesOffset(t *testing.T) {
	ctx := context.Background()
	fake := &fakeTelegram{batches: [][]Update{
		{{UpdateID: 40, Message: &Message{MessageID: 1, Chat: Chat{ID: 555}, Text: "   "}}},
	}}
	poller, settingsStore, ideaStore := newTestPoller(t, fake)
	mustSetToken(t, ctx, settingsStore)
	mustPair(t, ctx, settingsStore, 555)

	if err := poller.Drain(ctx); err != nil {
		t.Fatalf("Drain: %v", err)
	}
	ideas, _ := ideaStore.List(ctx, idea.ListFilter{})
	if len(ideas) != 0 {
		t.Errorf("ideas = %d, want 0", len(ideas))
	}
	offset, _, _ := settingsStore.Get(ctx, KeyOffset)
	if offset != "41" {
		t.Errorf("offset = %q, want %q — one bad message must never wedge the queue", offset, "41")
	}
}

func TestDrainReimportingSameMessageIsNoOp(t *testing.T) {
	ctx := context.Background()
	fake := &fakeTelegram{batches: [][]Update{
		{{UpdateID: 50, Message: &Message{MessageID: 7, Chat: Chat{ID: 555}, Text: "Same idea"}}},
		{{UpdateID: 50, Message: &Message{MessageID: 7, Chat: Chat{ID: 555}, Text: "Same idea"}}},
	}}
	poller, settingsStore, ideaStore := newTestPoller(t, fake)
	mustSetToken(t, ctx, settingsStore)
	mustPair(t, ctx, settingsStore, 555)

	if err := poller.Drain(ctx); err != nil {
		t.Fatalf("Drain 1: %v", err)
	}
	// Simulate a restart re-fetching from a stale offset: reset it to 0 so
	// the fake serves the same update again.
	if err := settingsStore.Set(ctx, KeyOffset, "0"); err != nil {
		t.Fatalf("resetting offset: %v", err)
	}
	if err := poller.Drain(ctx); err != nil {
		t.Fatalf("Drain 2 (re-import): %v", err)
	}

	ideas, _ := ideaStore.List(ctx, idea.ListFilter{})
	if len(ideas) != 1 {
		t.Errorf("ideas = %d, want 1 — the unique origin index must reject the duplicate", len(ideas))
	}
}

func TestPairingWithCorrectCode(t *testing.T) {
	ctx := context.Background()
	fake := &fakeTelegram{batches: [][]Update{
		{{UpdateID: 1, Message: &Message{MessageID: 1, Chat: Chat{ID: 555}, Text: "ABC123"}}},
	}}
	poller, settingsStore, _ := newTestPoller(t, fake)
	mustSetToken(t, ctx, settingsStore)
	if err := settingsStore.Set(ctx, KeyPairCode, "ABC123|"+strconv.FormatInt(time.Now().Add(time.Minute).Unix(), 10)); err != nil {
		t.Fatalf("seeding pair code: %v", err)
	}

	if err := poller.Drain(ctx); err != nil {
		t.Fatalf("Drain: %v", err)
	}

	chatID, paired, err := settingsStore.Get(ctx, KeyChatID)
	if err != nil || !paired {
		t.Fatalf("expected pairing to succeed: paired=%v err=%v", paired, err)
	}
	if chatID != "555" {
		t.Errorf("chat_id = %q, want %q", chatID, "555")
	}
	if _, stillActive, _ := settingsStore.Get(ctx, KeyPairCode); stillActive {
		t.Errorf("pairing code should be consumed after a successful pair")
	}
}

func TestPairingWithWrongCodeDoesNotPair(t *testing.T) {
	ctx := context.Background()
	fake := &fakeTelegram{batches: [][]Update{
		{{UpdateID: 1, Message: &Message{MessageID: 1, Chat: Chat{ID: 555}, Text: "WRONGX"}}},
	}}
	poller, settingsStore, _ := newTestPoller(t, fake)
	mustSetToken(t, ctx, settingsStore)
	if err := settingsStore.Set(ctx, KeyPairCode, "ABC123|"+strconv.FormatInt(time.Now().Add(time.Minute).Unix(), 10)); err != nil {
		t.Fatalf("seeding pair code: %v", err)
	}

	if err := poller.Drain(ctx); err != nil {
		t.Fatalf("Drain: %v", err)
	}
	if _, paired, _ := settingsStore.Get(ctx, KeyChatID); paired {
		t.Errorf("wrong code must not pair")
	}
	if len(fake.sent) != 0 {
		t.Errorf("sent = %v, want no reply while unpaired", fake.sent)
	}
}

func TestPairingWithExpiredCodeDoesNotPair(t *testing.T) {
	ctx := context.Background()
	fake := &fakeTelegram{batches: [][]Update{
		{{UpdateID: 1, Message: &Message{MessageID: 1, Chat: Chat{ID: 555}, Text: "ABC123"}}},
	}}
	poller, settingsStore, _ := newTestPoller(t, fake)
	mustSetToken(t, ctx, settingsStore)
	if err := settingsStore.Set(ctx, KeyPairCode, "ABC123|"+strconv.FormatInt(time.Now().Add(-time.Minute).Unix(), 10)); err != nil {
		t.Fatalf("seeding expired pair code: %v", err)
	}

	if err := poller.Drain(ctx); err != nil {
		t.Fatalf("Drain: %v", err)
	}
	if _, paired, _ := settingsStore.Get(ctx, KeyChatID); paired {
		t.Errorf("expired code must not pair")
	}
}

func TestSecondChatCannotRepairOnceBound(t *testing.T) {
	ctx := context.Background()
	fake := &fakeTelegram{batches: [][]Update{
		{{UpdateID: 1, Message: &Message{MessageID: 1, Chat: Chat{ID: 777}, Text: "ABC123"}}},
	}}
	poller, settingsStore, _ := newTestPoller(t, fake)
	mustSetToken(t, ctx, settingsStore)
	mustPair(t, ctx, settingsStore, 555) // already bound to 555
	if err := settingsStore.Set(ctx, KeyPairCode, "ABC123|"+strconv.FormatInt(time.Now().Add(time.Minute).Unix(), 10)); err != nil {
		t.Fatalf("seeding pair code: %v", err)
	}

	if err := poller.Drain(ctx); err != nil {
		t.Fatalf("Drain: %v", err)
	}
	chatID, _, _ := settingsStore.Get(ctx, KeyChatID)
	if chatID != "555" {
		t.Errorf("chat_id = %q, want it to remain %q — already-paired chats cannot be displaced", chatID, "555")
	}
}

// waitFor polls cond until it holds or the deadline passes.
func waitFor(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for %s", what)
		}
		time.Sleep(2 * time.Millisecond)
	}
}

func (f *fakeTelegram) calls() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.getCalls
}

// A 401 or 409 must stop the loop calling Telegram (retrying cannot help, or
// makes it worse), but it must not kill the only getUpdates goroutine: once
// the user reconnects a working token from the settings screen — which calls
// Sync() — capture has to resume without restarting the app.
func TestLoopParksOnFatalStatusAndResumesOnSync(t *testing.T) {
	for _, status := range []int{http.StatusUnauthorized, http.StatusConflict} {
		t.Run(strconv.Itoa(status), func(t *testing.T) {
			fake := &fakeTelegram{failStatus: status}
			poller, settingsStore, ideaStore := newTestPoller(t, fake)
			ctx := context.Background()
			mustSetToken(t, ctx, settingsStore)
			mustPair(t, ctx, settingsStore, 555)

			loopCtx, cancel := context.WithCancel(ctx)
			done := make(chan struct{})
			go func() { poller.Loop(loopCtx); close(done) }()
			defer func() { cancel(); <-done }()

			waitFor(t, "the failing getUpdates call", func() bool { return fake.calls() >= 1 })
			waitFor(t, "the recorded last error", func() bool {
				v, ok, _ := settingsStore.Get(ctx, KeyLastError)
				return ok && v != ""
			})

			// Backoff is 1ms in tests, so a loop that kept retrying would rack
			// up dozens of calls in this window.
			time.Sleep(50 * time.Millisecond)
			if n := fake.calls(); n != 1 {
				t.Fatalf("getUpdates called %d times after a %d, want exactly 1 — the loop must stop retrying", n, status)
			}
			select {
			case <-done:
				t.Fatalf("Loop returned after a %d; it must stay alive so a reconnect can resume capture", status)
			default:
			}

			// The user fixes the problem (a new token, the webhook removed) and
			// the settings handler wakes the loop.
			fake.mu.Lock()
			fake.failStatus = 0
			fake.batches = [][]Update{{{UpdateID: 1, Message: &Message{MessageID: 42, Chat: Chat{ID: 555}, Text: "Resumed after reconnect"}}}}
			fake.getCalls = 0
			fake.mu.Unlock()
			poller.Sync()

			waitFor(t, "the queued message to be imported", func() bool {
				ideas, err := ideaStore.List(ctx, idea.ListFilter{})
				return err == nil && len(ideas) == 1 && ideas[0].Title == "Resumed after reconnect"
			})
			waitFor(t, "the last error to clear", func() bool {
				_, ok, _ := settingsStore.Get(ctx, KeyLastError)
				return !ok
			})
		})
	}
}

func TestLoopParkedOnFatalStatusStillStopsOnCancel(t *testing.T) {
	fake := &fakeTelegram{failStatus: http.StatusUnauthorized}
	poller, settingsStore, _ := newTestPoller(t, fake)
	mustSetToken(t, context.Background(), settingsStore)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { poller.Loop(ctx); close(done) }()

	waitFor(t, "the failing getUpdates call", func() bool { return fake.calls() >= 1 })
	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Loop parked on a 401 did not return after its context was cancelled")
	}
}

func TestLoopContinuesAfterNetworkError(t *testing.T) {
	fake := &fakeTelegram{failStatus: http.StatusInternalServerError}
	poller, settingsStore, _ := newTestPoller(t, fake)
	mustSetToken(t, context.Background(), settingsStore)

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	done := make(chan struct{})
	go func() { poller.Loop(ctx); close(done) }()

	select {
	case <-done:
		// Fine either way as long as it happens via ctx cancellation, not an
		// early return — check below that it kept retrying.
	case <-time.After(200 * time.Millisecond):
		t.Fatal("Loop.Loop never returned after its context was cancelled")
	}

	fake.mu.Lock()
	calls := fake.getCalls
	fake.mu.Unlock()
	if calls < 2 {
		t.Errorf("getUpdates called %d times, want several — a 5xx must back off and retry, not stop", calls)
	}
}

// With no token there is nothing to fetch, so the loop must park until Sync()
// rather than spin through no-op Drains. Connecting a token (which Syncs)
// starts capture.
func TestLoopWithNoTokenParksUntilSync(t *testing.T) {
	fake := &fakeTelegram{batches: [][]Update{
		{{UpdateID: 1, Message: &Message{MessageID: 1, Chat: Chat{ID: 555}, Text: "First capture"}}},
	}}
	poller, settingsStore, ideaStore := newTestPoller(t, fake)
	ctx := context.Background()
	mustPair(t, ctx, settingsStore, 555)
	// A loop spinning on no-op Drains treats each one as a successful fetch
	// and clears this; a parked loop leaves it alone.
	if err := settingsStore.Set(ctx, KeyLastError, "left over"); err != nil {
		t.Fatalf("seeding last error: %v", err)
	}

	loopCtx, cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() { poller.Loop(loopCtx); close(done) }()
	defer func() { cancel(); <-done }()

	time.Sleep(50 * time.Millisecond)
	if _, ok, _ := settingsStore.Get(ctx, KeyLastError); !ok {
		t.Fatal("last error was cleared with no token stored — the loop is spinning instead of parking")
	}
	if n := fake.calls(); n != 0 {
		t.Fatalf("getUpdates called %d times with no token, want 0", n)
	}

	mustSetToken(t, ctx, settingsStore)
	poller.Sync()

	waitFor(t, "the queued message to be imported", func() bool {
		ideas, err := ideaStore.List(ctx, idea.ListFilter{})
		return err == nil && len(ideas) == 1 && ideas[0].Title == "First capture"
	})
}

// A Sync() only cuts short the getUpdates wait. Once a batch has arrived it
// must be imported in full and its offset saved, or the rest of the batch is
// lost (or, mid-pairing, the code is re-imported as a nugget).
func TestSyncDuringBatchProcessingFinishesTheBatch(t *testing.T) {
	entered := make(chan struct{})
	release := make(chan struct{})
	var once sync.Once
	fake := &fakeTelegram{
		batches: [][]Update{{
			{UpdateID: 1, Message: &Message{MessageID: 1, Chat: Chat{ID: 555}, Text: "First"}},
			{UpdateID: 2, Message: &Message{MessageID: 2, Chat: Chat{ID: 555}, Text: "Second"}},
		}},
		onSend: func() { once.Do(func() { close(entered); <-release }) },
	}
	poller, settingsStore, ideaStore := newTestPoller(t, fake)
	ctx := context.Background()
	mustSetToken(t, ctx, settingsStore)
	mustPair(t, ctx, settingsStore, 555)

	loopCtx, cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() { poller.Loop(loopCtx); close(done) }()
	defer func() { cancel(); <-done }()

	select {
	case <-entered:
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for the first reply")
	}
	// The first reply is in flight: press sync, give the loop time to act on
	// it, then let the reply finish.
	poller.Sync()
	time.Sleep(20 * time.Millisecond)
	close(release)

	waitFor(t, "both messages to be imported", func() bool {
		ideas, err := ideaStore.List(ctx, idea.ListFilter{})
		return err == nil && len(ideas) == 2
	})
	waitFor(t, "the offset to pass the batch", func() bool {
		v, _, _ := settingsStore.Get(ctx, KeyOffset)
		return v == "3"
	})
}

// Disconnecting while a fetched batch is still being processed (here, stuck
// on a reply) must not let that batch save the old bot's offset afterwards,
// or a newly connected bot would silently skip its lower-numbered updates.
func TestResetDuringBatchLeavesNoOffset(t *testing.T) {
	entered := make(chan struct{})
	release := make(chan struct{})
	var once sync.Once
	fake := &fakeTelegram{
		batches: [][]Update{{
			{UpdateID: 7, Message: &Message{MessageID: 1, Chat: Chat{ID: 555}, Text: "First"}},
		}},
		onSend: func() { once.Do(func() { close(entered); <-release }) },
	}
	poller, settingsStore, _ := newTestPoller(t, fake)
	ctx := context.Background()
	mustSetToken(t, ctx, settingsStore)
	mustPair(t, ctx, settingsStore, 555)

	loopCtx, cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() { poller.Loop(loopCtx); close(done) }()
	defer func() { cancel(); <-done }()

	select {
	case <-entered:
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for the reply")
	}

	reset := make(chan error, 1)
	go func() {
		reset <- poller.Reset(func() error {
			for _, key := range []string{KeyToken, KeyChatID, KeyOffset} {
				if err := settingsStore.Delete(ctx, key); err != nil {
					return err
				}
			}
			return nil
		})
	}()
	time.Sleep(20 * time.Millisecond)
	close(release)

	select {
	case err := <-reset:
		if err != nil {
			t.Fatalf("Reset: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Reset never returned")
	}
	time.Sleep(20 * time.Millisecond)
	if offset, ok, _ := settingsStore.Get(ctx, KeyOffset); ok {
		t.Errorf("offset = %q after reset, want none — the old batch wrote it back", offset)
	}
}

// A reply that never gets an answer must time out rather than hold up the
// rest of the batch (and so every later fetch) forever.
func TestStalledReplyTimesOutAndBatchFinishes(t *testing.T) {
	release := make(chan struct{})
	fake := &fakeTelegram{
		batches: [][]Update{{
			{UpdateID: 1, Message: &Message{MessageID: 1, Chat: Chat{ID: 555}, Text: "First"}},
			{UpdateID: 2, Message: &Message{MessageID: 2, Chat: Chat{ID: 555}, Text: "Second"}},
		}},
		onSend: func() { <-release },
	}
	poller, settingsStore, ideaStore := newTestPoller(t, fake, WithRequestTimeout(20*time.Millisecond))
	t.Cleanup(func() { close(release) })
	ctx := context.Background()
	mustSetToken(t, ctx, settingsStore)
	mustPair(t, ctx, settingsStore, 555)

	if err := poller.Drain(ctx); err != nil {
		t.Fatalf("Drain: %v", err)
	}
	ideas, _ := ideaStore.List(ctx, idea.ListFilter{})
	if len(ideas) != 2 {
		t.Errorf("ideas = %d, want 2", len(ideas))
	}
	if offset, _, _ := settingsStore.Get(ctx, KeyOffset); offset != "3" {
		t.Errorf("offset = %q, want %q", offset, "3")
	}
}

// A long network backoff must not make the sync button a no-op.
func TestSyncCutsNetworkBackoffShort(t *testing.T) {
	fake := &fakeTelegram{failStatus: http.StatusInternalServerError}
	poller, settingsStore, _ := newTestPoller(t, fake, WithBackoff(time.Hour, time.Hour))
	mustSetToken(t, context.Background(), settingsStore)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { poller.Loop(ctx); close(done) }()
	defer func() { cancel(); <-done }()

	waitFor(t, "the first failing getUpdates call", func() bool { return fake.calls() >= 1 })
	poller.Sync()
	waitFor(t, "a retry after Sync", func() bool { return fake.calls() >= 2 })
}
