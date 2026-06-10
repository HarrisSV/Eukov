package repository

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"github.com/eukov/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupRepositoryDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "repo.db")), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	stmts := []string{
		`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL, token_version INTEGER NOT NULL DEFAULT 1, created_at DATETIME, updated_at DATETIME);`,
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

func TestUserRepository_CreateAndFind(t *testing.T) {
	db := setupRepositoryDB(t)
	repo := NewUserRepository(db)
	ctx := context.Background()

	user := &models.User{
		Email:        "reader@example.com",
		PasswordHash: "hashed",
		Role:         "READER",
	}

	if err := repo.Create(ctx, user); err != nil {
		t.Fatalf("create user: %v", err)
	}

	found, err := repo.FindByEmail(ctx, user.Email)
	if err != nil {
		t.Fatalf("find by email: %v", err)
	}
	if found.Email != user.Email {
		t.Fatalf("expected %s, got %s", user.Email, found.Email)
	}
}

func TestUserRepository_NotFound(t *testing.T) {
	db := setupRepositoryDB(t)
	repo := NewUserRepository(db)
	ctx := context.Background()

	_, err := repo.FindByEmail(ctx, "missing@example.com")
	if !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("expected ErrUserNotFound, got %v", err)
	}

	_, err = repo.FindByID(ctx, uuid.New())
	if !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("expected ErrUserNotFound, got %v", err)
	}
}

func TestUserRepository_DuplicateEmail(t *testing.T) {
	db := setupRepositoryDB(t)
	repo := NewUserRepository(db)
	ctx := context.Background()

	user := &models.User{
		Email:        "reader@example.com",
		PasswordHash: "hashed",
		Role:         "READER",
	}
	if err := repo.Create(ctx, user); err != nil {
		t.Fatalf("create user: %v", err)
	}

	err := repo.Create(ctx, &models.User{
		Email:        "reader@example.com",
		PasswordHash: "hashed2",
		Role:         "READER",
	})
	if !errors.Is(err, ErrUserAlreadyExists) {
		t.Fatalf("expected ErrUserAlreadyExists, got %v", err)
	}
}

func TestGenreRepository_FindByNames(t *testing.T) {
	db := setupRepositoryDB(t)
	repo := NewGenreRepository(db)
	ctx := context.Background()

	if err := db.Create(&[]models.Genre{
		{ID: uuid.New(), Name: "history"},
		{ID: uuid.New(), Name: "science"},
	}).Error; err != nil {
		t.Fatalf("seed genres: %v", err)
	}

	genres, err := repo.FindByNames(ctx, []string{"history", "science"})
	if err != nil {
		t.Fatalf("find by names: %v", err)
	}
	if len(genres) != 2 {
		t.Fatalf("expected 2 genres, got %d", len(genres))
	}

	_, err = repo.FindByNames(ctx, []string{"history", "missing"})
	if !errors.Is(err, ErrGenreNotFound) {
		t.Fatalf("expected ErrGenreNotFound, got %v", err)
	}
}

func TestGenreRepository_FindAll(t *testing.T) {
	db := setupRepositoryDB(t)
	repo := NewGenreRepository(db)
	ctx := context.Background()

	if err := db.Create(&[]models.Genre{
		{ID: uuid.New(), Name: "science"},
		{ID: uuid.New(), Name: "history"},
	}).Error; err != nil {
		t.Fatalf("seed genres: %v", err)
	}

	genres, err := repo.FindAll(ctx)
	if err != nil {
		t.Fatalf("find all genres: %v", err)
	}
	if len(genres) != 2 {
		t.Fatalf("expected 2 genres, got %d", len(genres))
	}
}

func TestPreferenceRepository_SaveAndGet(t *testing.T) {
	db := setupRepositoryDB(t)
	ctx := context.Background()

	user := models.User{
		Email:        "reader@example.com",
		PasswordHash: "hashed",
		Role:         "READER",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	genres := []models.Genre{{ID: uuid.New(), Name: "history"}, {ID: uuid.New(), Name: "science"}}
	if err := db.Create(&genres).Error; err != nil {
		t.Fatalf("create genres: %v", err)
	}

	repo := NewPreferenceRepository(db)
	genreIDs := []uuid.UUID{genres[0].ID, genres[1].ID}
	if err := repo.SaveUserGenres(ctx, user.ID, genreIDs); err != nil {
		t.Fatalf("save user genres: %v", err)
	}

	names, err := repo.GetUserGenreNames(ctx, user.ID)
	if err != nil {
		t.Fatalf("get user genre names: %v", err)
	}
	if len(names) != 2 {
		t.Fatalf("expected 2 names, got %d", len(names))
	}
}
