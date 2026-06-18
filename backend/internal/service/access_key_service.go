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
	keys     *repository.AccessKeyRepository
	users    *repository.UserRepository
	apps     *repository.AuthorApplicationRepository
	audit    *AuditService
	inbox    *InboxService
}

func NewAccessKeyService(
	keys *repository.AccessKeyRepository,
	users *repository.UserRepository,
	apps *repository.AuthorApplicationRepository,
	audit *AuditService,
	inbox *InboxService,
) *AccessKeyService {
	return &AccessKeyService{
		keys:  keys,
		users: users,
		apps:  apps,
		audit: audit,
		inbox: inbox,
	}
}

type GeneratedAccessKey struct {
	KeyID     uuid.UUID
	PlainKey  string
	ExpiresAt time.Time
}

type GenerateAccessKeyInput struct {
	CreatedBy     uuid.UUID
	TTL           time.Duration
	TargetRole    string
	ApplicationID *uuid.UUID
}

func (s *AccessKeyService) Generate(ctx context.Context, createdBy uuid.UUID, ttl time.Duration) (*GeneratedAccessKey, error) {
	return s.GenerateFor(ctx, GenerateAccessKeyInput{
		CreatedBy:  createdBy,
		TTL:        ttl,
		TargetRole: roles.Admin,
	})
}

func (s *AccessKeyService) GenerateFor(ctx context.Context, input GenerateAccessKeyInput) (*GeneratedAccessKey, error) {
	ttl := input.TTL
	if ttl <= 0 {
		ttl = 7 * 24 * time.Hour
	}
	targetRole := input.TargetRole
	if targetRole == "" {
		targetRole = roles.Admin
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
		KeyHash:       hash,
		CreatedBy:     input.CreatedBy,
		TargetRole:    targetRole,
		ApplicationID: input.ApplicationID,
		ExpiresAt:     time.Now().Add(ttl),
		Status:        "ACTIVE",
	}
	if err := s.keys.Create(ctx, record); err != nil {
		return nil, err
	}

	actorID := input.CreatedBy
	if err := s.audit.Record(ctx, &actorID, "ACCESS_KEY_GENERATED", "access_key", &record.ID, map[string]any{
		"expiresAt":  record.ExpiresAt,
		"targetRole": targetRole,
	}); err != nil {
		return nil, err
	}

	return &GeneratedAccessKey{
		KeyID:     record.ID,
		PlainKey:  plain,
		ExpiresAt: record.ExpiresAt,
	}, nil
}

type ConsumeAccessKeyResult struct {
	Role string
}

func (s *AccessKeyService) Consume(ctx context.Context, userID uuid.UUID, plainKey string) (*ConsumeAccessKeyResult, error) {
	user, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	keys, err := s.keys.ListActiveUnconsumed(ctx)
	if err != nil {
		return nil, err
	}

	var matched *models.AccessKey
	for i := range keys {
		if compareSecret(keys[i].KeyHash, plainKey) {
			matched = &keys[i]
			break
		}
	}
	if matched == nil {
		return nil, ErrAccessKeyInvalid
	}
	if time.Now().After(matched.ExpiresAt) {
		matched.Status = "EXPIRED"
		_ = s.keys.Update(ctx, matched)
		return nil, ErrAccessKeyInvalid
	}
	if matched.Status != "ACTIVE" {
		return nil, ErrAccessKeyUsed
	}

	targetRole := matched.TargetRole
	if targetRole == "" {
		targetRole = roles.Admin
	}

	if err := s.validateConsumeTarget(user.Role, targetRole); err != nil {
		return nil, err
	}

	if matched.ApplicationID != nil && s.apps != nil {
		app, err := s.apps.FindByID(ctx, *matched.ApplicationID)
		if err != nil || app.UserID != userID {
			return nil, ErrAccessKeyInvalid
		}
	}

	now := time.Now()
	matched.Status = "CONSUMED"
	matched.ConsumedBy = &userID
	matched.ConsumedAt = &now
	if err := s.keys.Update(ctx, matched); err != nil {
		return nil, err
	}

	if err := s.users.UpdateRole(ctx, userID, targetRole); err != nil {
		return nil, err
	}

	if matched.ApplicationID != nil && s.apps != nil && targetRole == roles.Author {
		app, err := s.apps.FindByID(ctx, *matched.ApplicationID)
		if err == nil && app.Status != "APPROVED" {
			app.Status = "APPROVED"
			app.ReviewedAt = &now
			app.UpdatedAt = now
			_ = s.apps.Update(ctx, app)
		}
	}

	actorID := userID
	_ = s.audit.Record(ctx, &actorID, "ACCESS_KEY_CONSUMED", "user", &userID, map[string]any{
		"accessKeyId": matched.ID,
		"targetRole":  targetRole,
	})

	if s.inbox != nil && targetRole == roles.Author {
		body := "Your access key was accepted. You are now an Author — open your Docket to start writing."
		_ = s.inbox.NotifyUser(ctx, userID, nil, InboxTypeAuthorPromoted,
			"You are now an Author", body, matched.ApplicationID, nil)
	}

	return &ConsumeAccessKeyResult{Role: targetRole}, nil
}

func (s *AccessKeyService) validateConsumeTarget(currentRole, targetRole string) error {
	switch targetRole {
	case roles.Author:
		if currentRole != roles.Reader {
			return errors.New("only readers can redeem author access keys")
		}
	case roles.Admin:
		if currentRole == roles.Admin || currentRole == roles.SuperAdmin {
			return errors.New("user already has admin privileges")
		}
	default:
		return errors.New("unsupported access key type")
	}
	return nil
}

func generatePlainAccessKey() (string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate access key: %w", err)
	}
	return "EUKOV-" + base64.RawURLEncoding.EncodeToString(buf), nil
}
