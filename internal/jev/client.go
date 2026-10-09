package jev

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// systemOneRequest is the body of POST /v1/systemone
// (https://docs.typesafe.ai/api.md).
type systemOneRequest struct {
	State     any                 `json:"state"`
	Model     string              `json:"model"`
	Questions map[string]question `json:"questions"`
}

// question is one noul (yes/no) question about a candidate tag. Question
// keys aren't sent to the model, so the instructions carry its whole meaning.
type question struct {
	Type         string       `json:"type"`
	Instructions instructions `json:"instructions"`
	Criteria     criteria     `json:"criteria"`
}

type instructions struct {
	Question string `json:"question"`
	Tag      string `json:"tag"`
	// Examples are titles of other active nuggets carrying the tag, which
	// explain a tag whose name alone is vague.
	Examples []string `json:"examples"`
}

type criteria struct {
	True  string `json:"true"`
	False string `json:"false"`
}

type systemOneResponse struct {
	Model   string `json:"model"`
	Answers map[string]struct {
		Type string   `json:"type"`
		Noul *float64 `json:"noul"`
	} `json:"answers"`
	Usage Usage `json:"usage"`
}

// Usage is the token count TypeSafe reports for one request.
type Usage struct {
	InputTokens  int64 `json:"input_tokens"`
	OutputTokens int64 `json:"output_tokens"`
}

// APIError is a non-2xx answer from TypeSafe.
type APIError struct {
	StatusCode int
	Message    string
	// RetryAfter is how long a 429 or 529 asked us to wait; 0 when it
	// didn't say.
	RetryAfter time.Duration
}

func (e *APIError) Error() string {
	if e.Message == "" {
		return fmt.Sprintf("typesafe: %d %s", e.StatusCode, http.StatusText(e.StatusCode))
	}
	return fmt.Sprintf("typesafe: %d %s", e.StatusCode, e.Message)
}

// Client calls TypeSafe's System One API. The key travels only in the
// Authorization header, never in a URL, so no transport error or log line
// built from a request can carry it. The Suggester is its only caller in the
// app; cmd/tagbench uses it to benchmark Jev.
type Client struct {
	BaseURL    string
	Key        string
	HTTPClient *http.Client
}

// Ask sends one request and returns each question's yes-probability by the
// tag it asks about, with the usage TypeSafe reported. A question missing
// from the answer is left out.
func (c *Client) Ask(ctx context.Context, req Request) (map[string]float64, Usage, error) {
	body, err := req.JSON()
	if err != nil {
		return nil, Usage{}, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(c.BaseURL, "/")+"/v1/systemone", bytes.NewReader(body))
	if err != nil {
		return nil, Usage{}, fmt.Errorf("building TypeSafe request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+c.Key)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("User-Agent", "nuggets")

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, Usage{}, fmt.Errorf("calling TypeSafe: %w", err)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, Usage{}, fmt.Errorf("reading TypeSafe response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return nil, Usage{}, apiError(resp, data)
	}
	var decoded systemOneResponse
	if err := json.Unmarshal(data, &decoded); err != nil {
		return nil, Usage{}, fmt.Errorf("decoding TypeSafe response: %w", err)
	}
	out := make(map[string]float64, len(decoded.Answers))
	for id, a := range decoded.Answers {
		if tag, ok := req.TagFor[id]; ok && a.Noul != nil {
			out[tag] = *a.Noul
		}
	}
	return out, decoded.Usage, nil
}

// maxErrorMessage bounds how much of an error body is kept.
const maxErrorMessage = 500

// apiError reads TypeSafe's error body. The docs promise only "a JSON body
// describing the problem", so the common shapes are tried in turn and the
// raw body is the fallback.
func apiError(resp *http.Response, data []byte) *APIError {
	apiErr := &APIError{StatusCode: resp.StatusCode}
	var envelope struct {
		Error   json.RawMessage `json:"error"`
		Message string          `json:"message"`
		Detail  json.RawMessage `json:"detail"`
	}
	if json.Unmarshal(data, &envelope) == nil {
		var nested struct {
			Message string `json:"message"`
		}
		var text string
		switch {
		case envelope.Message != "":
			apiErr.Message = envelope.Message
		case len(envelope.Error) > 0 && json.Unmarshal(envelope.Error, &nested) == nil && nested.Message != "":
			apiErr.Message = nested.Message
		case len(envelope.Error) > 0 && json.Unmarshal(envelope.Error, &text) == nil:
			apiErr.Message = text
		case len(envelope.Detail) > 0 && json.Unmarshal(envelope.Detail, &text) == nil:
			apiErr.Message = text
		case len(envelope.Detail) > 0:
			apiErr.Message = string(envelope.Detail)
		}
	}
	if apiErr.Message == "" {
		apiErr.Message = strings.TrimSpace(string(data))
	}
	if len(apiErr.Message) > maxErrorMessage {
		apiErr.Message = apiErr.Message[:maxErrorMessage] + "…"
	}
	if secs, err := strconv.Atoi(strings.TrimSpace(resp.Header.Get("Retry-After"))); err == nil && secs > 0 {
		apiErr.RetryAfter = time.Duration(secs) * time.Second
	} else if at, err := http.ParseTime(resp.Header.Get("Retry-After")); err == nil {
		apiErr.RetryAfter = time.Until(at)
	}
	return apiErr
}
