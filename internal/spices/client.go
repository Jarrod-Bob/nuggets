// Package spices pulls ideas from the captain's spices capture service over
// its pull API (contract v1, spices design §7). Design:
// docs/superpowers/specs/2026-09-26-spices-pull-design.md.
package spices

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Client talks to one spices server. The token travels only in the
// Authorization header, never in a URL, so no transport error or log line
// built from a request URL can carry it.
type Client struct {
	BaseURL    string // e.g. "http://127.0.0.1:7788", no trailing slash
	Token      string
	HTTPClient *http.Client
}

func NewClient(baseURL, token string, httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &Client{BaseURL: strings.TrimRight(baseURL, "/"), Token: token, HTTPClient: httpClient}
}

// APIError is a non-2xx answer from spices, with the message from its error
// envelope ({"error":{"message":"…"}}) when it sent one.
type APIError struct {
	StatusCode int
	Message    string
}

func (e *APIError) Error() string {
	if e.Message == "" {
		return fmt.Sprintf("spices: %d %s", e.StatusCode, http.StatusText(e.StatusCode))
	}
	return fmt.Sprintf("spices: %d %s", e.StatusCode, e.Message)
}

// Item is one entry of GET /api/v1/items. Fields not used by nuggets (meta,
// source, timestamps other than deleted_at) are ignored.
type Item struct {
	ID        int64                      `json:"id"`
	Type      string                     `json:"type"`
	Rev       int64                      `json:"rev"`
	Text      string                     `json:"text"`
	URL       *string                    `json:"url"`
	Tags      []string                   `json:"tags"`
	Fields    map[string]json.RawMessage `json:"fields"`
	DeletedAt *time.Time                 `json:"deleted_at"`
}

// Field returns a string field of the item's per-type form, or "" when it is
// absent or not a string.
func (it Item) Field(key string) string {
	raw, ok := it.Fields[key]
	if !ok {
		return ""
	}
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return ""
	}
	return s
}

// Page is one answer from GET /api/v1/items.
type Page struct {
	Items      []Item
	NextCursor int64
	HasMore    bool
	// Undecodable counts items skipped because they didn't decode. The cursor
	// still moves past them: one bad item must never wedge the feed.
	Undecodable int
}

type pageWire struct {
	Items      []json.RawMessage `json:"items"`
	NextCursor int64             `json:"next_cursor"`
	HasMore    bool              `json:"has_more"`
}

// Items fetches changes after since, filtered to types, at most limit items.
func (c *Client) Items(ctx context.Context, since int64, types []string, limit int) (Page, error) {
	q := url.Values{}
	q.Set("since", strconv.FormatInt(since, 10))
	for _, t := range types {
		q.Add("type", t)
	}
	if limit > 0 {
		q.Set("limit", strconv.Itoa(limit))
	}
	var wire pageWire
	if err := c.do(ctx, http.MethodGet, "/api/v1/items?"+q.Encode(), nil, &wire); err != nil {
		return Page{}, err
	}
	page := Page{NextCursor: wire.NextCursor, HasMore: wire.HasMore}
	for _, raw := range wire.Items {
		var item Item
		if err := json.Unmarshal(raw, &item); err != nil {
			page.Undecodable++
			continue
		}
		page.Items = append(page.Items, item)
	}
	return page, nil
}

// AckCursor reports progress with PUT /api/v1/consumers/{name}/cursor. It is
// only a report: the consumer's own stored cursor stays authoritative.
func (c *Client) AckCursor(ctx context.Context, consumer string, cursor int64) error {
	body, err := json.Marshal(map[string]int64{"cursor": cursor})
	if err != nil {
		return err
	}
	return c.do(ctx, http.MethodPut, "/api/v1/consumers/"+url.PathEscape(consumer)+"/cursor", body, nil)
}

func (c *Client) do(ctx context.Context, method, path string, body []byte, out any) error {
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, reader)
	if err != nil {
		return fmt.Errorf("building spices request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("calling spices: %w", err)
	}
	defer resp.Body.Close()

	// A page is at most 500 items; 16 MiB is far past any real answer and
	// keeps a misbehaving server from exhausting memory.
	data, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return fmt.Errorf("reading spices response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		apiErr := &APIError{StatusCode: resp.StatusCode}
		var envelope struct {
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		if json.Unmarshal(data, &envelope) == nil {
			apiErr.Message = envelope.Error.Message
		}
		return apiErr
	}
	if out == nil {
		return nil
	}
	if err := json.Unmarshal(data, out); err != nil {
		return fmt.Errorf("decoding spices response: %w", err)
	}
	return nil
}
