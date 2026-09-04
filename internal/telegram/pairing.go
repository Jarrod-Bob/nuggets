package telegram

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"strconv"
	"strings"
	"time"

	"github.com/Jarrod-Bob/nuggets/internal/settings"
)

// Settings keys (design §5). Shared by the poller and the settings API
// handlers, so both sides agree on exactly what is stored.
const (
	KeyToken     = "telegram_token"
	KeyUsername  = "telegram_username"
	KeyChatID    = "telegram_chat_id"
	KeyOffset    = "telegram_offset"
	KeyPairCode  = "telegram_pair_code"
	KeyLastError = "telegram_last_error"

	// SourceTelegram tags an imported idea's `source` column (design §5).
	SourceTelegram = "telegram"

	pairCodeCharset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O/1/I: read aloud or typed on a phone
	pairCodeLength  = 6

	// PairCodeTTL is how long a generated pairing code stays valid (design §4.4).
	PairCodeTTL = 15 * time.Minute
)

// PairCode is an active, unexpired pairing code plus when it expires.
type PairCode struct {
	Code      string
	ExpiresAt time.Time
}

func generateCode() (string, error) {
	b := make([]byte, pairCodeLength)
	for i := range b {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(pairCodeCharset))))
		if err != nil {
			return "", fmt.Errorf("generating pairing code: %w", err)
		}
		b[i] = pairCodeCharset[n.Int64()]
	}
	return string(b), nil
}

// NewPairCode generates a fresh code valid for PairCodeTTL and stores it,
// replacing whatever code was previously active.
func NewPairCode(ctx context.Context, store *settings.Store) (PairCode, error) {
	code, err := generateCode()
	if err != nil {
		return PairCode{}, err
	}
	expiresAt := time.Now().Add(PairCodeTTL).UTC()
	value := code + "|" + strconv.FormatInt(expiresAt.Unix(), 10)
	if err := store.Set(ctx, KeyPairCode, value); err != nil {
		return PairCode{}, err
	}
	return PairCode{Code: code, ExpiresAt: expiresAt}, nil
}

// ActivePairCode reads the stored pairing code, treating an expired one (or
// a missing one) as absent.
func ActivePairCode(ctx context.Context, store *settings.Store) (PairCode, bool, error) {
	raw, ok, err := store.Get(ctx, KeyPairCode)
	if err != nil || !ok {
		return PairCode{}, false, err
	}
	parts := strings.SplitN(raw, "|", 2)
	if len(parts) != 2 {
		return PairCode{}, false, nil
	}
	unix, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return PairCode{}, false, nil
	}
	expiresAt := time.Unix(unix, 0).UTC()
	if time.Now().After(expiresAt) {
		return PairCode{}, false, nil
	}
	return PairCode{Code: parts[0], ExpiresAt: expiresAt}, true, nil
}
