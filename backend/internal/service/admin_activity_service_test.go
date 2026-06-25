package service

import (
	"testing"

	"github.com/eukov/backend/internal/models"
	"github.com/google/uuid"
)

func TestAuthorActivityDisplayName_prefersNickname(t *testing.T) {
	name := authorActivityDisplayName(models.User{
		ID:        uuid.New(),
		Email:     "user@example.com",
		Nickname:  "HarrisSV",
		FirstName: "Suyash",
		LastName:  "Verma",
	})
	if name != "HarrisSV" {
		t.Fatalf("expected HarrisSV, got %q", name)
	}
}

func TestAuthorActivityDisplayName_fallsBackToFullName(t *testing.T) {
	name := authorActivityDisplayName(models.User{
		Email:     "user@example.com",
		FirstName: "Suyash",
		LastName:  "Verma",
	})
	if name != "Suyash Verma" {
		t.Fatalf("expected Suyash Verma, got %q", name)
	}
}
