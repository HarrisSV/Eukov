package service

import (
	"context"
	"testing"

	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/repository"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type mockUserRepo struct {
	users map[string]*models.User
}

func newMockUserRepo() *mockUserRepo {
	return &mockUserRepo{users: make(map[string]*models.User)}
}

func (m *mockUserRepo) Create(_ context.Context, user *models.User) error {
	if _, ok := m.users[user.Email]; ok {
		return repository.ErrUserAlreadyExists
	}
	user.ID = uuid.New()
	m.users[user.Email] = user
	return nil
}

func TestRegisterPasswordHashing(t *testing.T) {
	repo := newMockUserRepo()
	password := "password123"

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}

	user := &models.User{
		Email:        "reader@example.com",
		PasswordHash: string(hash),
		Role:         "READER",
	}

	if err := repo.Create(context.Background(), user); err != nil {
		t.Fatalf("create user: %v", err)
	}

	if user.Role != "READER" {
		t.Fatalf("expected READER role, got %s", user.Role)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		t.Fatalf("password hash mismatch: %v", err)
	}

	if err := repo.Create(context.Background(), user); err != repository.ErrUserAlreadyExists {
		t.Fatalf("expected duplicate user error")
	}
}

func TestStorageService_EnsureDirectories(t *testing.T) {
	dir := t.TempDir()
	svc := NewStorageService(dir)

	if err := svc.EnsureDirectories(); err != nil {
		t.Fatalf("ensure directories: %v", err)
	}

	if !svc.IsReady() {
		t.Fatal("expected storage to be ready")
	}
}
