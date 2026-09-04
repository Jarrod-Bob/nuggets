// Package telegram implements nugget capture from a Telegram bot via
// getUpdates long polling (design: docs/superpowers/specs/2026-08-30-telegram-capture-design.md).
package telegram

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
)

// Client talks to the Telegram Bot API. BaseURL and HTTPClient are both
// parameters rather than defaults so tests can point at an
// httptest.NewServer fake and never touch the network (design §10).
type Client struct {
	// BaseURL is the API root including the bot token, e.g.
	// "https://api.telegram.org/bot<token>". Never logged: it contains the
	// secret (design §4.3).
	BaseURL    string
	HTTPClient *http.Client
}

func NewClient(baseURL string, httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &Client{BaseURL: baseURL, HTTPClient: httpClient}
}

// DefaultBaseURL builds the real Telegram API root for a token.
func DefaultBaseURL(token string) string {
	return "https://api.telegram.org/bot" + token
}

// APIError is a non-OK response from Telegram. StatusCode and Description
// come straight from Telegram; RetryAfter is only meaningful for 429s
// (design §9).
type APIError struct {
	StatusCode  int
	Description string
	RetryAfter  int // seconds, from parameters.retry_after; 0 if absent
}

func (e *APIError) Error() string {
	return fmt.Sprintf("telegram: %d %s", e.StatusCode, e.Description)
}

type apiResponse[T any] struct {
	OK          bool   `json:"ok"`
	Description string `json:"description"`
	Result      T      `json:"result"`
	Parameters  struct {
		RetryAfter int `json:"retry_after"`
	} `json:"parameters"`
}

// User is Telegram's getMe result — just enough to show a bot username on
// the settings screen.
type User struct {
	ID       int64  `json:"id"`
	IsBot    bool   `json:"is_bot"`
	Username string `json:"username"`
}

type Chat struct {
	ID int64 `json:"id"`
}

type Message struct {
	MessageID int64  `json:"message_id"`
	Chat      Chat   `json:"chat"`
	Text      string `json:"text"`
}

type Update struct {
	UpdateID int64    `json:"update_id"`
	Message  *Message `json:"message"`
}

// call makes a GET request against method and decodes the JSON envelope.
// Query values are never logged: on a bot-token base URL they would leak the
// secret via the request URL (design §4.3).
func (c *Client) call(ctx context.Context, method string, query url.Values, out any) error {
	u := c.BaseURL + "/" + method
	if len(query) > 0 {
		u += "?" + query.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return fmt.Errorf("building request for %s: %w", method, err)
	}
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("calling %s: %w", method, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("reading %s response: %w", method, err)
	}

	var decoded apiResponse[json.RawMessage]
	if err := json.Unmarshal(body, &decoded); err != nil {
		return fmt.Errorf("decoding %s response (status %d): %w", method, resp.StatusCode, err)
	}
	if resp.StatusCode != http.StatusOK || !decoded.OK {
		return &APIError{StatusCode: resp.StatusCode, Description: decoded.Description, RetryAfter: decoded.Parameters.RetryAfter}
	}
	if out != nil && len(decoded.Result) > 0 {
		if err := json.Unmarshal(decoded.Result, out); err != nil {
			return fmt.Errorf("decoding %s result: %w", method, err)
		}
	}
	return nil
}

// GetMe validates the token and reports the bot's identity.
func (c *Client) GetMe(ctx context.Context) (User, error) {
	var user User
	err := c.call(ctx, "getMe", nil, &user)
	return user, err
}

// GetUpdates fetches updates from offset onward, holding the request open for
// up to timeoutSeconds waiting for something to arrive (design §4.2).
func (c *Client) GetUpdates(ctx context.Context, offset int64, timeoutSeconds int) ([]Update, error) {
	q := url.Values{}
	if offset != 0 {
		q.Set("offset", strconv.FormatInt(offset, 10))
	}
	q.Set("timeout", strconv.Itoa(timeoutSeconds))
	var updates []Update
	if err := c.call(ctx, "getUpdates", q, &updates); err != nil {
		return nil, err
	}
	return updates, nil
}

// SendMessage replies into a chat. Failures here are never fatal to the
// caller (design §7): the nugget is already saved by the time this runs.
func (c *Client) SendMessage(ctx context.Context, chatID int64, text string) error {
	q := url.Values{}
	q.Set("chat_id", strconv.FormatInt(chatID, 10))
	q.Set("text", text)
	return c.call(ctx, "sendMessage", q, nil)
}
