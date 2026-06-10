package service

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/repository"
	"github.com/eukov/backend/internal/roles"
	"github.com/google/uuid"
)

var (
	ErrAccessKeyInvalid = errors.New("invalid or expired access key")
	ErrAccessKeyUsed    = errors.New("access key already consumed")
)

type AccessKeyService struct {
	keys  *repository.AccessKeyRepository
	users *repository.UserRepository
	audit *AuditService
}

func NewAccessKeyService(
	keys *repository.AccessKeyRepository,
	users *repository.UserRepository,
	audit *AuditService,
) *AccessKeyService {
	return &AccessKeyService{keys: keys, users: users, audit: audit}
}

type GeneratedAccessKey struct {
	KeyID     uuid.UUID
	PlainKey  string
	ExpiresAt time.Time
}

func (s *AccessKeyService) Generate(ctx context.Context, createdBy uuid.UUID, ttl time.Duration) (*GeneratedAccessKey, error) {
	if ttl <= 0 {
		ttl = 7 * 24 * time.Hour
	}

	plain, err := generatePlainAccessKey()
	if err != nil {
		return nil, err
	}

	hash, err := hashAccessKey(plain)
	if err != nil {
		return nil, err
	}

	record := &models.AccessKey{
		KeyHash:   hash,
		CreatedBy: createdBy,
		ExpiresAt: time.Now().Add(ttl),
		Status:    "ACTIVE",
	}
	if err := s.keys.Create(ctx, record); err != nil {
		return nil, err
	}

	actorID := createdBy
	if err := s.audit.Record(ctx, &actorID, "ACCESS_KEY_GENERATED", "access_key", &record.ID, map[string]any{
		"expiresAt": record.ExpiresAt,
	}); err != nil {
		return nil, err
	}

	return &GeneratedAccessKey{
		KeyID:     record.ID,
		PlainKey:  plain,
		ExpiresAt: record.ExpiresAt,
	}, nil
}

func (s *AccessKeyService) Consume(ctx context.Context, userID uuid.UUID, plainKey string) error {
	user, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return err
	}
	if user.Role == roles.Admin || user.Role == roles.SuperAdmin {
		return errors.New("user already has admin privileges")
	}

	keys, err := s.keys.ListActiveUnconsumed(ctx)
	if err != nil {
		return err
	}

	var matched *models.AccessKey
	for i := range keys {
		if compareSecret(keys[i].KeyHash, plainKey) {
			matched = &keys[i]
			break
		}
	}
	if matched == nil {
		return ErrAccessKeyInvalid
	}
	if time.Now().After(matched.ExpiresAt) {
		matched.Status = "EXPIRED"
		_ = s.keys.Update(ctx, matched)
		return ErrAccessKeyInvalid
	}
	if matched.Status != "ACTIVE" {
		return ErrAccessKeyUsed
	}

	now := time.Now()
	matched.Status = "CONSUMED"
	matched.ConsumedBy = &userID
	matched.ConsumedAt = &now
	if err := s.keys.Update(ctx, matched); err != nil {
		return err
	}

	if err := s.users.UpdateRole(ctx, userID, roles.Admin); err != nil {
		return err
	}

	actorID := userID
	return s.audit.Record(ctx, &actorID, "ADMIN_PROMOTED", "user", &userID, map[string]any{
		"accessKeyId": matched.ID,
	})
}

func generatePlainAccessKey() (string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate access key: %w", err)
	}
	return "EUKOV-" + base64.RawURLEncoding.EncodeToString(buf), nil
}
