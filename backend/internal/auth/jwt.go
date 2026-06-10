package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var ErrInvalidToken = errors.New("invalid token")

type TokenPair struct {
	AccessToken  string
	RefreshToken string
}

type Claims struct {
	UserID       string `json:"user_id"`
	Role         string `json:"role"`
	Email        string `json:"email"`
	TokenVersion int    `json:"token_version"`
	jwt.RegisteredClaims
}

type JWTService struct {
	secret          []byte
	accessTokenTTL  time.Duration
	refreshTokenTTL time.Duration
}

func NewJWTService(secret string, accessMinutes, refreshDays int) *JWTService {
	return &JWTService{
		secret:          []byte(secret),
		accessTokenTTL:  time.Duration(accessMinutes) * time.Minute,
		refreshTokenTTL: time.Duration(refreshDays) * 24 * time.Hour,
	}
}

func (s *JWTService) GenerateAccessToken(userID uuid.UUID, email, role string, tokenVersion int) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:       userID.String(),
		Role:         role,
		Email:        email,
		TokenVersion: tokenVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.accessTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   userID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.secret)
	if err != nil {
		return "", fmt.Errorf("sign access token: %w", err)
	}
	return signed, nil
}

func (s *JWTService) ParseAccessToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return s.secret, nil
	})
	if err != nil {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}
	return claims, nil
}

func (s *JWTService) RefreshTokenTTL() time.Duration {
	return s.refreshTokenTTL
}
