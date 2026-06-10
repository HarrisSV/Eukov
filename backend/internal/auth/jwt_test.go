package auth

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestJWTService_GenerateAndParse(t *testing.T) {
	svc := NewJWTService("test-secret-key-32chars-minimum!", 15, 7)
	userID := uuid.New()

	token, err := svc.GenerateAccessToken(userID, "admin@example.com", "ADMIN", 2)
	if err != nil {
		t.Fatalf("generate: %v", err)
	}

	claims, err := svc.ParseAccessToken(token)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if claims.UserID != userID.String() {
		t.Fatalf("expected user id %s, got %s", userID, claims.UserID)
	}
	if claims.Role != "ADMIN" {
		t.Fatalf("expected role ADMIN, got %s", claims.Role)
	}
	if claims.TokenVersion != 2 {
		t.Fatalf("expected token version 2, got %d", claims.TokenVersion)
	}
}

func TestJWTService_InvalidToken(t *testing.T) {
	svc := NewJWTService("test-secret-key-32chars-minimum!", 15, 7)
	if _, err := svc.ParseAccessToken("not-a-token"); err == nil {
		t.Fatal("expected invalid token error")
	}
}

func TestJWTService_RefreshTokenTTL(t *testing.T) {
	svc := NewJWTService("test-secret-key-32chars-minimum!", 15, 7)
	if svc.RefreshTokenTTL() != 7*24*time.Hour {
		t.Fatalf("unexpected refresh ttl: %v", svc.RefreshTokenTTL())
	}
}
