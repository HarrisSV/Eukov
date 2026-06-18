package service

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/repository"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupDocumentService(t *testing.T) (*DocumentService, uuid.UUID) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "doc.db")), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	stmts := []string{
		`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL, first_name TEXT, middle_name TEXT, last_name TEXT, nickname TEXT, token_version INTEGER DEFAULT 1, created_at DATETIME, updated_at DATETIME);`,
		`CREATE TABLE genres (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);`,
		`CREATE TABLE dockets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, created_at DATETIME);`,
		`CREATE TABLE documents (id TEXT PRIMARY KEY, docket_id TEXT NOT NULL, author_id TEXT NOT NULL, title TEXT NOT NULL, file_path TEXT NOT NULL, status TEXT NOT NULL, genre_id TEXT, published_at DATETIME, created_at DATETIME, updated_at DATETIME);`,
		`CREATE TABLE document_tags (id TEXT PRIMARY KEY, document_id TEXT NOT NULL, tag TEXT NOT NULL, created_at DATETIME);`,
		`CREATE TABLE unpublish_requests (id TEXT PRIMARY KEY, document_id TEXT NOT NULL, author_id TEXT NOT NULL, status TEXT NOT NULL, justification TEXT NOT NULL, actioned_by TEXT, created_at DATETIME, updated_at DATETIME);`,
		`CREATE TABLE document_metadata (id TEXT PRIMARY KEY, document_id TEXT NOT NULL UNIQUE, genre_id TEXT NOT NULL, summary TEXT, reading_time INTEGER, created_at DATETIME);`,
		`CREATE TABLE docket_items (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, item_type TEXT NOT NULL, item_id TEXT NOT NULL, saved_at DATETIME);`,
		`CREATE TABLE publish_audit_events (id TEXT PRIMARY KEY, document_id TEXT, actor_id TEXT, event_type TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}', created_at DATETIME);`,
		`CREATE TABLE audit_logs (id TEXT PRIMARY KEY, actor_id TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, metadata TEXT NOT NULL DEFAULT '{}', created_at DATETIME);`,
	}
	for _, stmt := range stmts {
		if err := db.Exec(stmt).Error; err != nil {
			t.Fatalf("schema: %v", err)
		}
	}

	genreID := uuid.New()
	authorID := uuid.New()
	if err := db.Create(&models.Genre{ID: genreID, Name: "history"}).Error; err != nil {
		t.Fatalf("seed genre: %v", err)
	}
	if err := db.Create(&models.User{ID: authorID, Email: "author@example.com", PasswordHash: "x", Role: "AUTHOR"}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}

	auditRepo := repository.NewAuditLogRepository(db)
	svc := NewDocumentService(
		repository.NewDocketRepository(db),
		repository.NewDocumentRepository(db),
		repository.NewDocumentTagRepository(db),
		repository.NewGenreRepository(db),
		repository.NewDocumentMetadataRepository(db),
		repository.NewDocketItemRepository(db),
		NewDocumentFileService(t.TempDir()),
		repository.NewUnpublishRepository(db),
		repository.NewPublishAuditEventRepository(db),
		NewAuditService(auditRepo),
	)
	return svc, authorID
}

func TestDocumentService_PublishValidation(t *testing.T) {
	svc, authorID := setupDocumentService(t)
	ctx := context.Background()

	doc, err := svc.CreateDraft(ctx, authorID, CreateDocumentInput{Title: "Draft", Content: "short"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	_, err = svc.Publish(ctx, authorID, doc.ID, PublishDocumentInput{
		Genre: "history",
		Tags:  []string{"politics"},
	})
	if err == nil || !strings.Contains(err.Error(), "200") {
		t.Fatalf("expected content length validation error, got %v", err)
	}
}
