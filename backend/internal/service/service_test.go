package service

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/repository"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "service.db")), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	stmts := []string{
		`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL, first_name TEXT, middle_name TEXT, last_name TEXT, nickname TEXT, token_version INTEGER NOT NULL DEFAULT 1, created_at DATETIME, updated_at DATETIME);`,
		`CREATE TABLE genres (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);`,
		`CREATE TABLE user_genres (user_id TEXT NOT NULL, genre_id TEXT NOT NULL, PRIMARY KEY (user_id, genre_id));`,
		`CREATE TABLE dockets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, created_at DATETIME);`,
		`CREATE TABLE documents (id TEXT PRIMARY KEY, docket_id TEXT NOT NULL, title TEXT NOT NULL, file_path TEXT NOT NULL, status TEXT NOT NULL, created_at DATETIME);`,
	}
	for _, stmt := range stmts {
		if err := db.Exec(stmt).Error; err != nil {
			t.Fatalf("create schema: %v", err)
		}
	}
	return db
}

func TestUserService_RegisterAndLogin(t *testing.T) {
	db := setupServiceTestDB(t)
	repo := repository.NewUserRepository(db)
	svc := NewUserService(repo)
	password := "password123"

	result, err := svc.Register(context.Background(), RegisterInput{
		Email:    "reader@example.com",
		Password: password,
	})
	if err != nil {
		t.Fatalf("register user: %v", err)
	}

	user, err := repo.FindByID(context.Background(), result.UserID)
	if err != nil {
		t.Fatalf("find by id: %v", err)
	}
	if user.Role != "READER" {
		t.Fatalf("expected READER role, got %s", user.Role)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		t.Fatalf("password hash mismatch: %v", err)
	}

	loginResult, err := svc.Login(context.Background(), LoginInput{
		Email:    "reader@example.com",
		Password: password,
	})
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}
	if loginResult.Email != "reader@example.com" {
		t.Fatalf("unexpected login email: %s", loginResult.Email)
	}

	_, err = svc.Login(context.Background(), LoginInput{
		Email:    "reader@example.com",
		Password: "wrong-password",
	})
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestUserService_EmailCaseInsensitive(t *testing.T) {
	db := setupServiceTestDB(t)
	svc := NewUserService(repository.NewUserRepository(db))
	password := "password123"

	_, err := svc.Register(context.Background(), RegisterInput{
		Email:    "Reader@Example.COM",
		Password: password,
	})
	if err != nil {
		t.Fatalf("register user: %v", err)
	}

	loginResult, err := svc.Login(context.Background(), LoginInput{
		Email:    "  READER@example.com  ",
		Password: password,
	})
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}
	if loginResult.Email != "reader@example.com" {
		t.Fatalf("expected lowercase email, got %s", loginResult.Email)
	}
}

func TestUserService_DuplicateEmail(t *testing.T) {
	db := setupServiceTestDB(t)
	svc := NewUserService(repository.NewUserRepository(db))

	_, err := svc.Register(context.Background(), RegisterInput{
		Email:    "reader@example.com",
		Password: "password123",
	})
	if err != nil {
		t.Fatalf("first register failed: %v", err)
	}

	_, err = svc.Register(context.Background(), RegisterInput{
		Email:    "Reader@Example.com",
		Password: "password123",
	})
	if !errors.Is(err, repository.ErrUserAlreadyExists) {
		t.Fatalf("expected duplicate user error, got %v", err)
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

func TestPreferenceService_SaveAndGet(t *testing.T) {
	db := setupServiceTestDB(t)
	ctx := context.Background()

	userRepo := repository.NewUserRepository(db)
	genreRepo := repository.NewGenreRepository(db)
	prefRepo := repository.NewPreferenceRepository(db)

	userSvc := NewUserService(userRepo)
	prefSvc := NewPreferenceService(userRepo, genreRepo, prefRepo)

	registerResult, err := userSvc.Register(ctx, RegisterInput{
		Email:    "reader@example.com",
		Password: "password123",
	})
	if err != nil {
		t.Fatalf("register user: %v", err)
	}

	if err := db.Create(&[]models.Genre{
		{ID: uuid.New(), Name: "history"},
		{ID: uuid.New(), Name: "science"},
	}).Error; err != nil {
		t.Fatalf("seed genres: %v", err)
	}

	if err := prefSvc.SavePreferences(ctx, PreferencesInput{
		UserID: registerResult.UserID,
		Genres: []string{"history", "science"},
	}); err != nil {
		t.Fatalf("save preferences: %v", err)
	}

	prefs, err := prefSvc.GetUserPreferences(ctx, registerResult.UserID)
	if err != nil {
		t.Fatalf("get preferences: %v", err)
	}
	if len(prefs) != 2 {
		t.Fatalf("expected 2 preferences, got %d", len(prefs))
	}
}

func TestPreferenceService_Errors(t *testing.T) {
	db := setupServiceTestDB(t)
	ctx := context.Background()

	userRepo := repository.NewUserRepository(db)
	genreRepo := repository.NewGenreRepository(db)
	prefRepo := repository.NewPreferenceRepository(db)
	prefSvc := NewPreferenceService(userRepo, genreRepo, prefRepo)

	err := prefSvc.SavePreferences(ctx, PreferencesInput{
		UserID: uuid.New(),
		Genres: []string{"history"},
	})
	if !errors.Is(err, repository.ErrUserNotFound) {
		t.Fatalf("expected ErrUserNotFound, got %v", err)
	}

	userSvc := NewUserService(userRepo)
	registerResult, err := userSvc.Register(ctx, RegisterInput{
		Email:    "reader2@example.com",
		Password: "password123",
	})
	if err != nil {
		t.Fatalf("register user: %v", err)
	}

	err = prefSvc.SavePreferences(ctx, PreferencesInput{
		UserID: registerResult.UserID,
		Genres: []string{"history"},
	})
	if !errors.Is(err, repository.ErrGenreNotFound) {
		t.Fatalf("expected ErrGenreNotFound, got %v", err)
	}
}
