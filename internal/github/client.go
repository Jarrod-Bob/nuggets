package github

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

// Client talks to GitHub's REST API. The token travels only in the
// Authorization header, never in a URL, so no transport error or log line
// built from a request URL can carry it.
type Client struct {
	BaseURL    string // e.g. "https://api.github.com", no trailing slash
	Token      string
	HTTPClient *http.Client
	// now is the clock rate-limit resets are measured against.
	now func() time.Time
}

func NewClient(baseURL, token string, httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &Client{BaseURL: strings.TrimRight(baseURL, "/"), Token: token, HTTPClient: httpClient, now: time.Now}
}

// APIError is a non-2xx answer from GitHub.
type APIError struct {
	StatusCode int
	Message    string
	// RateLimited is set for a 403 or 429 that GitHub marked as a rate
	// limit; RetryAfter is how long it asked us to wait (0 when it didn't
	// say).
	RateLimited bool
	RetryAfter  time.Duration
}

func (e *APIError) Error() string {
	if e.Message == "" {
		return fmt.Sprintf("github: %d %s", e.StatusCode, http.StatusText(e.StatusCode))
	}
	return fmt.Sprintf("github: %d %s", e.StatusCode, e.Message)
}

// NewIssue is the body of POST /repos/{owner}/{repo}/issues.
type NewIssue struct {
	Title  string   `json:"title"`
	Body   string   `json:"body"`
	Labels []string `json:"labels,omitempty"`
}

// CreatedIssue is the part of GitHub's issue object nuggets keeps.
type CreatedIssue struct {
	Number  int    `json:"number"`
	HTMLURL string `json:"html_url"`
	Body    string `json:"body"`
}

// CreateIssue opens an issue on repo ("owner/repo").
func (c *Client) CreateIssue(ctx context.Context, repo string, issue NewIssue) (CreatedIssue, error) {
	body, err := json.Marshal(issue)
	if err != nil {
		return CreatedIssue{}, err
	}
	var created CreatedIssue
	if err := c.do(ctx, http.MethodPost, repoPath(repo)+"/issues", body, &created); err != nil {
		return CreatedIssue{}, err
	}
	return created, nil
}

// maxSearchPages bounds FindIssue: 500 issues touched since the first
// attempt is far past anything one person's repositories see in the minutes
// between a lost answer and the retry.
const maxSearchPages = 5

// FindIssue looks through repo's issues updated since since for one whose
// body contains marker, returning nil when there is none. It lists rather
// than using the search API: search is indexed with a delay, and the issue
// it must find may be seconds old.
func (c *Client) FindIssue(ctx context.Context, repo, marker string, since time.Time) (*CreatedIssue, error) {
	for page := 1; page <= maxSearchPages; page++ {
		q := url.Values{}
		q.Set("state", "all")
		q.Set("since", since.UTC().Format(time.RFC3339))
		q.Set("sort", "created")
		q.Set("direction", "desc")
		q.Set("per_page", "100")
		q.Set("page", strconv.Itoa(page))
		var issues []CreatedIssue
		if err := c.do(ctx, http.MethodGet, repoPath(repo)+"/issues?"+q.Encode(), nil, &issues); err != nil {
			return nil, err
		}
		for _, is := range issues {
			if strings.Contains(is.Body, marker) {
				found := is
				return &found, nil
			}
		}
		if len(issues) < 100 {
			return nil, nil
		}
	}
	return nil, nil
}

// repoPath is /repos/{owner}/{repo}, each part escaped. ValidateMappings has
// already restricted both to URL-safe characters; escaping is belt and
// braces.
func repoPath(repo string) string {
	owner, name, _ := strings.Cut(repo, "/")
	return "/repos/" + url.PathEscape(owner) + "/" + url.PathEscape(name)
}

// maxRateLimitWait caps how long a rate-limit header can hold the queue, in
// case one is nonsense.
const maxRateLimitWait = time.Hour

// secondaryRateLimitWait is GitHub's advice for a secondary rate limit that
// names no time: wait at least a minute.
const secondaryRateLimitWait = time.Minute

func (c *Client) do(ctx context.Context, method, path string, body []byte, out any) error {
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, reader)
	if err != nil {
		return fmt.Errorf("building GitHub request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", "nuggets")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("calling GitHub: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return fmt.Errorf("reading GitHub response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return c.apiError(resp, data)
	}
	if out == nil {
		return nil
	}
	if err := json.Unmarshal(data, out); err != nil {
		return fmt.Errorf("decoding GitHub response: %w", err)
	}
	return nil
}

// apiError reads GitHub's error body ({"message": "…", "errors": [...]}) and
// rate-limit headers.
func (c *Client) apiError(resp *http.Response, data []byte) *APIError {
	apiErr := &APIError{StatusCode: resp.StatusCode}
	var envelope struct {
		Message string `json:"message"`
		Errors  []struct {
			Message string `json:"message"`
			Field   string `json:"field"`
			Code    string `json:"code"`
		} `json:"errors"`
	}
	if json.Unmarshal(data, &envelope) == nil {
		apiErr.Message = envelope.Message
		for _, e := range envelope.Errors {
			detail := e.Message
			if detail == "" && e.Field != "" {
				detail = e.Field + " " + e.Code
			}
			if detail != "" {
				apiErr.Message += " (" + detail + ")"
			}
		}
	}
	if resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusTooManyRequests {
		apiErr.RateLimited, apiErr.RetryAfter = rateLimit(resp.Header, apiErr.Message, c.now())
		// A 429 is always a rate limit, even without the headers.
		if resp.StatusCode == http.StatusTooManyRequests && !apiErr.RateLimited {
			apiErr.RateLimited, apiErr.RetryAfter = true, secondaryRateLimitWait
		}
	}
	return apiErr
}

// rateLimit reads GitHub's rate-limit signals: Retry-After (seconds),
// otherwise X-RateLimit-Remaining 0 with X-RateLimit-Reset (epoch seconds),
// otherwise a message naming a rate limit (a secondary limit), which gets a
// minute. A 403 with none of these is a permission problem, not a limit.
func rateLimit(h http.Header, message string, now time.Time) (bool, time.Duration) {
	clamp := func(d time.Duration) time.Duration {
		if d < time.Second {
			d = time.Second
		}
		if d > maxRateLimitWait {
			d = maxRateLimitWait
		}
		return d
	}
	if secs, err := strconv.Atoi(strings.TrimSpace(h.Get("Retry-After"))); err == nil && secs >= 0 {
		return true, clamp(time.Duration(secs) * time.Second)
	}
	if strings.TrimSpace(h.Get("X-RateLimit-Remaining")) == "0" {
		if reset, err := strconv.ParseInt(strings.TrimSpace(h.Get("X-RateLimit-Reset")), 10, 64); err == nil {
			return true, clamp(time.Unix(reset, 0).Sub(now) + time.Second)
		}
		return true, secondaryRateLimitWait
	}
	if strings.Contains(strings.ToLower(message), "rate limit") {
		return true, secondaryRateLimitWait
	}
	return false, 0
}
