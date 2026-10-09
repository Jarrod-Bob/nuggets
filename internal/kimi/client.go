// Package kimi asks kimi-no-name-wa, a sibling app on the same machine, to
// suggest project names for a nugget. Its API contract is the "API" section of
// kimi-no-name-wa's README. Design:
// docs/superpowers/specs/2026-10-09-kimi-project-name-design.md.
//
// Unlike spices and GitHub there is no background loop: each call is made
// when the captain clicks, on the browser request's context, so closing the
// form cancels it. What the one-goroutine rule protects is kept by building
// a single Client in cmd/nuggets/main.go and handing it to the handlers.
package kimi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

const (
	// SuggestionCount is how many names nuggets asks for. Not configurable.
	SuggestionCount = 5
	// ClientName is who kimi's history shows as asking.
	ClientName = "nuggets"
	// Timeout is just over kimi's own 5-minute model timeout, so kimi
	// reports a slow model itself rather than nuggets hanging up first.
	Timeout = 6 * time.Minute
)

var (
	// ErrUnavailable means kimi, or the Ollama behind it, isn't there to
	// ask: nothing answered, or kimi said ollama_unreachable or
	// model_missing. The API answers 503.
	ErrUnavailable = errors.New("kimi is not available")
	// ErrModelError means kimi is up but its model couldn't run: kimi said
	// model_error. Kimi's health still says ok then, so the API answers 502
	// with its own code and the form stops offering kimi (issue #36).
	ErrModelError = errors.New("kimi's model couldn't run")
	// ErrFailed is any other failure from kimi, including no_names and
	// model_timeout. The API answers 502.
	ErrFailed = errors.New("kimi couldn't suggest names")
)

// Name is one suggestion, as kimi returned it.
type Name struct {
	Name        string `json:"name"`
	Explanation string `json:"explanation"`
	Technique   string `json:"technique"`
	Tone        string `json:"tone"`
}

// Client talks to the kimi at the address saved in settings, read afresh on
// every call so a Settings change applies at once.
type Client struct {
	settings   *settings.Store
	httpClient *http.Client
}

// NewClient builds the one Client. A nil httpClient gets one with Timeout.
func NewClient(store *settings.Store, httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: Timeout}
	}
	return &Client{settings: store, httpClient: httpClient}
}

type namesRequest struct {
	Description string   `json:"description"`
	Count       int      `json:"count"`
	Avoid       []string `json:"avoid,omitempty"`
	Client      string   `json:"client"`
}

// Names asks kimi for SuggestionCount names for a nugget described by notes,
// leaving out the names in avoid. A cancelled ctx returns ctx's error.
func (c *Client) Names(ctx context.Context, notes string, avoid []string) ([]Name, error) {
	base, err := LoadURL(ctx, c.settings)
	if err != nil {
		return nil, err
	}
	body, err := json.Marshal(namesRequest{Description: notes, Count: SuggestionCount, Avoid: avoid, Client: ClientName})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/api/v1/names", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, apiError(resp)
	}
	var decoded struct {
		Names []Name `json:"names"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return nil, ctxErr
		}
		return nil, fmt.Errorf("%w: decoding its answer: %v", ErrFailed, err)
	}
	return decoded.Names, nil
}

// healthTimeout bounds a health check, which runs whenever the form opens:
// a kimi that doesn't answer quickly is reported as unavailable.
const healthTimeout = 5 * time.Second

// Available reports whether kimi can generate names right now: it answered
// GET /api/v1/health with status "ok". Unreachable, "degraded" or any error
// is false.
func (c *Client) Available(ctx context.Context) bool {
	ctx, cancel := context.WithTimeout(ctx, healthTimeout)
	defer cancel()
	base, err := LoadURL(ctx, c.settings)
	if err != nil {
		return false
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base+"/api/v1/health", nil)
	if err != nil {
		return false
	}
	resp, err := c.do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	var health struct {
		Status string `json:"status"`
	}
	if resp.StatusCode != http.StatusOK || json.NewDecoder(resp.Body).Decode(&health) != nil {
		return false
	}
	return health.Status == "ok"
}

// do sends req, telling a cancelled caller, an unreachable kimi and a slow
// one apart.
func (c *Client) do(req *http.Request) (*http.Response, error) {
	resp, err := c.httpClient.Do(req)
	if err == nil {
		return resp, nil
	}
	if ctxErr := req.Context().Err(); ctxErr != nil {
		return nil, ctxErr
	}
	// Failing to connect at all, even by timing out, is an unreachable kimi.
	// Any other timeout is the client's own, on a kimi that answered too slowly.
	var opErr *net.OpError
	if errors.As(err, &opErr) && opErr.Op == "dial" {
		return nil, fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return nil, fmt.Errorf("%w: %v", ErrFailed, err)
	}
	return nil, fmt.Errorf("%w: %v", ErrUnavailable, err)
}

// apiError turns a non-200 answer into ErrUnavailable, ErrModelError or
// ErrFailed, keeping
// kimi's own message (from {"error":{"message","code"}}) for the log.
func apiError(resp *http.Response) error {
	var envelope struct {
		Error struct {
			Message string `json:"message"`
			Code    string `json:"code"`
		} `json:"error"`
	}
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	_ = json.Unmarshal(raw, &envelope)
	kind := ErrFailed
	switch envelope.Error.Code {
	case "ollama_unreachable", "model_missing":
		kind = ErrUnavailable
	case "model_error":
		kind = ErrModelError
	}
	detail := envelope.Error.Message
	if detail == "" {
		detail = http.StatusText(resp.StatusCode)
	}
	return fmt.Errorf("%w: %d %s: %s", kind, resp.StatusCode, envelope.Error.Code, detail)
}
