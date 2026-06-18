package service

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/repository"
	"github.com/eukov/backend/internal/roles"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupPhase4DB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "phase4.db")), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	stmts := []string{
		`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL, first_name TEXT, middle_name TEXT, last_name TEXT, nickname TEXT, token_version INTEGER NOT NULL DEFAULT 1, created_at DATETIME, updated_at DATETIME);`,
		`CREATE TABLE genres (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);`,
		`CREATE TABLE user_genres (user_id TEXT NOT NULL, genre_id TEXT NOT NULL, PRIMARY KEY (user_id, genre_id));`,
		`CREATE TABLE dockets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, created_at DATETIME);`,
		`CREATE TABLE documents (id TEXT PRIMARY KEY, docket_id TEXT NOT NULL, author_id TEXT NOT NULL, title TEXT NOT NULL, file_path TEXT NOT NULL, status TEXT NOT NULL, genre_id TEXT, published_at DATETIME, created_at DATETIME, updated_at DATETIME);`,
		`CREATE TABLE document_tags (id TEXT PRIMARY KEY, document_id TEXT NOT NULL, tag TEXT NOT NULL, created_at DATETIME);`,
		`CREATE TABLE document_metadata (id TEXT PRIMARY KEY, document_id TEXT NOT NULL UNIQUE, genre_id TEXT NOT NULL, summary TEXT, reading_time INTEGER, created_at DATETIME);`,
		`CREATE TABLE docket_items (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, item_type TEXT NOT NULL, item_id TEXT NOT NULL, saved_at DATETIME);`,
		`CREATE TABLE author_subscriptions (id TEXT PRIMARY KEY, reader_id TEXT NOT NULL, author_id TEXT NOT NULL, created_at DATETIME, UNIQUE (reader_id, author_id));`,
		`CREATE TABLE issued_books (id TEXT PRIMARY KEY, reader_id TEXT NOT NULL, document_id TEXT NOT NULL, issued_at DATETIME NOT NULL, last_opened_at DATETIME, UNIQUE (reader_id, document_id));`,
		`CREATE TABLE reading_progress (id TEXT PRIMARY KEY, reader_id TEXT NOT NULL, document_id TEXT NOT NULL, current_page INTEGER NOT NULL DEFAULT 1, completion_percentage REAL NOT NULL DEFAULT 0, last_read_at DATETIME);`,
		`CREATE TABLE reader_activity (id TEXT PRIMARY KEY, reader_id TEXT NOT NULL, document_id TEXT NOT NULL, activity_type TEXT NOT NULL, created_at DATETIME);`,
		`CREATE TABLE audit_logs (id TEXT PRIMARY KEY, actor_id TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, metadata TEXT NOT NULL DEFAULT '{}', created_at DATETIME);`,
	}
	for _, stmt := range stmts {
		if err := db.Exec(stmt).Error; err != nil {
			t.Fatalf("schema: %v", err)
		}
	}
	return db
}

func seedPhase4Users(t *testing.T, db *gorm.DB) (readerID, authorID, genreID, docID uuid.UUID) {
	t.Helper()
	ctx := context.Background()
	hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	readerID = uuid.New()
	authorID = uuid.New()
	genreID = uuid.New()
	docID = uuid.New()
	docketID := uuid.New()

	if err := db.Create(&models.Genre{ID: genreID, Name: "history"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.User{ID: readerID, Email: "reader@test.com", PasswordHash: string(hash), Role: roles.Reader}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.User{ID: authorID, Email: "author@test.com", PasswordHash: string(hash), Role: roles.Author}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Docket{ID: docketID, UserID: authorID, Name: "Author Docket"}).Error; err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	if err := db.Create(&models.Document{
		ID: docID, DocketID: docketID, AuthorID: authorID, Title: "Published Book",
		FilePath: "x", Status: "PUBLISHED", GenreID: &genreID, PublishedAt: &now,
	}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.DocumentMetadata{ID: uuid.New(), DocumentID: docID, GenreID: genreID, Summary: "A history book"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := repository.NewPreferenceRepository(db).SaveUserGenres(ctx, readerID, []uuid.UUID{genreID}); err != nil {
		t.Fatal(err)
	}
	return readerID, authorID, genreID, docID
}

func TestLibraryService_SearchPublished(t *testing.T) {
	db := setupPhase4DB(t)
	_, _, _, _ = seedPhase4Users(t, db)
	svc := NewLibraryService(repository.NewDocumentRepository(db), repository.NewDocumentTagRepository(db), repository.NewGenreRepository(db))
	books, err := svc.List(context.Background(), repository.LibrarySearchParams{Query: "history"})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(books) != 1 {
		t.Fatalf("expected 1 book, got %d", len(books))
	}
}

func TestSubscriptionAndIssuanceFlow(t *testing.T) {
	db := setupPhase4DB(t)
	ctx := context.Background()
	readerID, authorID, _, docID := seedPhase4Users(t, db)
	auditSvc := NewAuditService(repository.NewAuditLogRepository(db))
	fileSvc := NewDocumentFileService(t.TempDir())
	if err := fileSvc.WriteContent(authorID, docID, "abcdefghij"); err != nil {
		t.Fatal(err)
	}

	issueSvc := NewIssuanceService(
		repository.NewIssuedBookRepository(db),
		repository.NewDocumentRepository(db),
		repository.NewAuthorSubscriptionRepository(db),
		repository.NewUserRepository(db),
		repository.NewReaderActivityRepository(db),
		repository.NewDocketItemRepository(db),
		repository.NewReadingProgressRepository(db),
	)

	subSvc := NewSubscriptionService(
		repository.NewAuthorSubscriptionRepository(db),
		repository.NewUserRepository(db),
		repository.NewDocketItemRepository(db),
		auditSvc,
		issueSvc,
	)
	if _, err := subSvc.Subscribe(ctx, readerID, authorID, &docID); err != nil {
		t.Fatalf("subscribe: %v", err)
	}
	book, err := issueSvc.Issue(ctx, readerID, docID)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	if book.DocumentID != docID {
		t.Fatal("wrong document issued")
	}

	readingSvc := NewReadingService(
		repository.NewDocumentRepository(db),
		fileSvc,
		issueSvc,
		repository.NewReadingProgressRepository(db),
	)
	page, err := readingSvc.GetPage(ctx, readerID, docID, 1)
	if err != nil {
		t.Fatalf("get page: %v", err)
	}
	if page.Content == "" {
		t.Fatal("expected page content")
	}

	progressSvc := NewProgressService(
		repository.NewReadingProgressRepository(db),
		issueSvc,
		repository.NewReaderActivityRepository(db),
		fileSvc,
		repository.NewDocumentRepository(db),
	)
	if _, err := progressSvc.Save(ctx, readerID, ProgressUpdate{DocumentID: docID, Page: 1}); err != nil {
		t.Fatalf("save progress: %v", err)
	}
}

func TestRecommendationService(t *testing.T) {
	db := setupPhase4DB(t)
	ctx := context.Background()
	readerID, _, _, _ := seedPhase4Users(t, db)
	svc := NewRecommendationService(
		repository.NewDocumentRepository(db),
		repository.NewDocumentTagRepository(db),
		repository.NewReaderActivityRepository(db),
		repository.NewPreferenceRepository(db),
	)
	recs, err := svc.Recommend(ctx, readerID, 5)
	if err != nil {
		t.Fatalf("recommend: %v", err)
	}
	if len(recs) == 0 {
		t.Fatal("expected recommendations")
	}
	if recs[0].Score < 10 {
		t.Fatalf("expected genre match score >= 10, got %d", recs[0].Score)
	}
}
