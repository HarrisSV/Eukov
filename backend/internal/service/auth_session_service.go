package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/eukov/backend/internal/auth"
	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/repository"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var ErrInvalidRefreshToken = errors.New("invalid refresh token")

type AuthSessionService struct {
	users    *repository.UserRepository
	refresh  *repository.RefreshTokenRepository
	jwt      *auth.JWTService
}

func NewAuthSessionService(
	users *repository.UserRepository,
	refresh *repository.RefreshTokenRepository,
	jwt *auth.JWTService,
) *AuthSessionService {
	return &AuthSessionService{users: users, refresh: refresh, jwt: jwt}
}

type SessionTokens struct {
	AccessToken  string
	RefreshToken string
}

type UserProfile struct {
	ID    uuid.UUID
	Email string
	Role  string
}

type LoginSessionResult struct {
	Tokens  SessionTokens
	Profile UserProfile
}

func (s *AuthSessionService) IssueTokens(ctx context.Context, user *models.User) (*LoginSessionResult, error) {
	access, err := s.jwt.GenerateAccessToken(user.ID, user.Email, user.Role, user.TokenVersion)
	if err != nil {
		return nil, err
	}

	refreshPlain, refreshHash, err := newRefreshToken()
	if err != nil {
		return nil, err
	}

	record := &models.RefreshToken{
		UserID:    user.ID,
		TokenHash: refreshHash,
		ExpiresAt: time.Now().Add(s.jwt.RefreshTokenTTL()),
	}
	if err := s.refresh.Create(ctx, record); err != nil {
		return nil, err
	}

	return &LoginSessionResult{
		Tokens: SessionTokens{
			AccessToken:  access,
			RefreshToken: refreshPlain,
		},
		Profile: UserProfile{
			ID:    user.ID,
			Email: user.Email,
			Role:  user.Role,
		},
	}, nil
}

func (s *AuthSessionService) Refresh(ctx context.Context, refreshToken string) (*LoginSessionResult, error) {
	hash := hashRefreshToken(refreshToken)
	record, err := s.refresh.FindByHash(ctx, hash)
	if err != nil {
		return nil, ErrInvalidRefreshToken
	}
	if time.Now().After(record.ExpiresAt) {
		_ = s.refresh.DeleteByHash(ctx, hash)
		return nil, ErrInvalidRefreshToken
	}

	user, err := s.users.FindByID(ctx, record.UserID)
	if err != nil {
		return nil, ErrInvalidRefreshToken
	}

	_ = s.refresh.DeleteByHash(ctx, hash)
	return s.IssueTokens(ctx, user)
}

func (s *AuthSessionService) Logout(ctx context.Context, userID uuid.UUID, refreshToken string) error {
	if refreshToken != "" {
		_ = s.refresh.DeleteByHash(ctx, hashRefreshToken(refreshToken))
	}
	return s.users.IncrementTokenVersion(ctx, userID)
}

func (s *AuthSessionService) ValidateAccessClaims(ctx context.Context, claims *auth.Claims) (*models.User, error) {
	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		return nil, auth.ErrInvalidToken
	}

	user, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return nil, auth.ErrInvalidToken
	}
	if user.TokenVersion != claims.TokenVersion {
		return nil, auth.ErrInvalidToken
	}
	return user, nil
}

func newRefreshToken() (plain string, hash string, err error) {
	buf := make([]byte, 32)
	if _, err = rand.Read(buf); err != nil {
		return "", "", fmt.Errorf("generate refresh token: %w", err)
	}
	plain = base64.RawURLEncoding.EncodeToString(buf)
	hash = hashRefreshToken(plain)
	return plain, hash, nil
}

func hashRefreshToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func hashAccessKey(key string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(key), bcryptCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func compareSecret(hash, plain string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}
