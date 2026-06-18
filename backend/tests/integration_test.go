package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/eukov/backend/internal/api"
	"github.com/eukov/backend/internal/auth"
	"github.com/eukov/backend/internal/middleware"
	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/repository"
	"github.com/eukov/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupIntegrationRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "integration.db")), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	stmts := []string{
		`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL, first_name TEXT, middle_name TEXT, last_name TEXT, nickname TEXT, token_version INTEGER NOT NULL DEFAULT 1, created_at DATETIME, updated_at DATETIME);`,
		`CREATE TABLE genres (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);`,
		`CREATE TABLE user_genres (user_id TEXT NOT NULL, genre_id TEXT NOT NULL, PRIMARY KEY (user_id, genre_id));`,
		`CREATE TABLE dockets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, created_at DATETIME);`,
		`CREATE TABLE documents (id TEXT PRIMARY KEY, docket_id TEXT NOT NULL, author_id TEXT NOT NULL, title TEXT NOT NULL, file_path TEXT NOT NULL, status TEXT NOT NULL, genre_id TEXT, published_at DATETIME, created_at DATETIME, updated_at DATETIME);`,
		`CREATE TABLE document_tags (id TEXT PRIMARY KEY, document_id TEXT NOT NULL, tag TEXT NOT NULL, created_at DATETIME);`,
		`CREATE TABLE unpublish_requests (id TEXT PRIMARY KEY, document_id TEXT NOT NULL, author_id TEXT NOT NULL, status TEXT NOT NULL, justification TEXT NOT NULL, actioned_by TEXT, created_at DATETIME, updated_at DATETIME);`,
		`CREATE TABLE document_metadata (id TEXT PRIMARY KEY, document_id TEXT NOT NULL UNIQUE, genre_id TEXT NOT NULL, summary TEXT, reading_time INTEGER, created_at DATETIME);`,
		`CREATE TABLE docket_items (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, item_type TEXT NOT NULL, item_id TEXT NOT NULL, saved_at DATETIME);`,
		`CREATE TABLE publish_audit_events (id TEXT PRIMARY KEY, document_id TEXT, actor_id TEXT, event_type TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}', created_at DATETIME);`,
		`CREATE TABLE audit_logs (id TEXT PRIMARY KEY, actor_id TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, metadata TEXT NOT NULL DEFAULT '{}', created_at DATETIME);`,
		`CREATE TABLE access_keys (id TEXT PRIMARY KEY, key_hash TEXT NOT NULL, created_by TEXT NOT NULL, consumed_by TEXT, expires_at DATETIME NOT NULL, consumed_at DATETIME, status TEXT NOT NULL, created_at DATETIME);`,
		`CREATE TABLE author_applications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, qualifications TEXT NOT NULL, experience TEXT NOT NULL, status TEXT NOT NULL, reviewed_by TEXT, reviewed_at DATETIME, created_at DATETIME, updated_at DATETIME);`,
		`CREATE TABLE refresh_tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at DATETIME NOT NULL, created_at DATETIME);`,
		`CREATE TABLE author_subscriptions (id TEXT PRIMARY KEY, reader_id TEXT NOT NULL, author_id TEXT NOT NULL, created_at DATETIME, UNIQUE (reader_id, author_id));`,
		`CREATE TABLE issued_books (id TEXT PRIMARY KEY, reader_id TEXT NOT NULL, document_id TEXT NOT NULL, issued_at DATETIME NOT NULL, last_opened_at DATETIME, UNIQUE (reader_id, document_id));`,
		`CREATE TABLE reading_progress (id TEXT PRIMARY KEY, reader_id TEXT NOT NULL, document_id TEXT NOT NULL, current_page INTEGER NOT NULL DEFAULT 1, completion_percentage REAL NOT NULL DEFAULT 0, last_read_at DATETIME);`,
		`CREATE TABLE reader_activity (id TEXT PRIMARY KEY, reader_id TEXT NOT NULL, document_id TEXT NOT NULL, activity_type TEXT NOT NULL, created_at DATETIME);`,
	}
	for _, stmt := range stmts {
		if err := db.Exec(stmt).Error; err != nil {
			t.Fatalf("migrate sqlite: %v", err)
		}
	}
	if err := db.Create(&[]models.Genre{{ID: uuid.New(), Name: "history"}, {ID: uuid.New(), Name: "science"}}).Error; err != nil {
		t.Fatalf("seed genres: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	genreRepo := repository.NewGenreRepository(db)
	documentRepo := repository.NewDocumentRepository(db)
	tagRepo := repository.NewDocumentTagRepository(db)
	prefRepo := repository.NewPreferenceRepository(db)
	accessKeyRepo := repository.NewAccessKeyRepository(db)
	authorAppRepo := repository.NewAuthorApplicationRepository(db)
	auditRepo := repository.NewAuditLogRepository(db)
	refreshRepo := repository.NewRefreshTokenRepository(db)

	jwtSvc := auth.NewJWTService("test-secret-key-32chars-minimum!", 15, 7)
	auditSvc := service.NewAuditService(auditRepo)
	fileSvc := service.NewDocumentFileService(t.TempDir())
	metadataRepo := repository.NewDocumentMetadataRepository(db)
	docketItemRepo := repository.NewDocketItemRepository(db)
	publishAuditRepo := repository.NewPublishAuditEventRepository(db)
	documentSvc := service.NewDocumentService(
		repository.NewDocketRepository(db),
		repository.NewDocumentRepository(db),
		repository.NewDocumentTagRepository(db),
		genreRepo,
		metadataRepo,
		docketItemRepo,
		fileSvc,
		repository.NewUnpublishRepository(db),
		publishAuditRepo,
		auditSvc,
	)
	docketSvc := service.NewDocketService(docketItemRepo, documentRepo, tagRepo, genreRepo, metadataRepo)
	adminActivitySvc := service.NewAdminActivityService(userRepo, documentRepo, publishAuditRepo, repository.NewUnpublishRepository(db))
	authorSubRepo := repository.NewAuthorSubscriptionRepository(db)
	issuedBookRepo := repository.NewIssuedBookRepository(db)
	readingProgressRepo := repository.NewReadingProgressRepository(db)
	readerActivityRepo := repository.NewReaderActivityRepository(db)
	librarySvc := service.NewLibraryService(documentRepo, tagRepo, genreRepo)
	recommendationSvc := service.NewRecommendationService(documentRepo, tagRepo, readerActivityRepo, prefRepo)
	issuanceSvc := service.NewIssuanceService(issuedBookRepo, documentRepo, authorSubRepo, userRepo, readerActivityRepo, docketItemRepo, readingProgressRepo)
	subscriptionSvc := service.NewSubscriptionService(authorSubRepo, userRepo, docketItemRepo, auditSvc, issuanceSvc)
	progressSvc := service.NewProgressService(readingProgressRepo, issuanceSvc, readerActivityRepo, fileSvc, documentRepo)
	readingSvc := service.NewReadingService(documentRepo, fileSvc, issuanceSvc, readingProgressRepo)
	h := api.NewHandler(
		service.NewUserService(userRepo),
		service.NewGenreService(genreRepo),
		service.NewPreferenceService(userRepo, genreRepo, prefRepo),
		service.NewStorageService(t.TempDir()),
		service.NewAuthSessionService(userRepo, refreshRepo, jwtSvc),
		service.NewAccessKeyService(accessKeyRepo, userRepo, auditSvc),
		service.NewAuthorApplicationService(authorAppRepo, userRepo, auditSvc),
		auditSvc,
		documentSvc,
		docketSvc,
		adminActivitySvc,
		librarySvc,
		recommendationSvc,
		subscriptionSvc,
		issuanceSvc,
		progressSvc,
		readingSvc,
	)

	r := gin.New()
	authLimiter := middleware.NewRateLimiter(1000, time.Minute)
	h.RegisterRoutes(r, jwtSvc, authLimiter)
	return r
}

func doReq(t *testing.T, r *gin.Engine, method, url string, body any) *httptest.ResponseRecorder {
	return doReqAuth(t, r, method, url, body, "")
}

func doReqAuth(t *testing.T, r *gin.Engine, method, url string, body any, token string) *httptest.ResponseRecorder {
	t.Helper()
	var payload []byte
	if body != nil {
		var err error
		payload, err = json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
	}
	req := httptest.NewRequest(method, url, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

func TestIntegration_RegisterLoginPreferencesFlow(t *testing.T) {
	r := setupIntegrationRouter(t)

	registerResp := doReq(t, r, http.MethodPost, "/api/v1/auth/register", map[string]string{
		"email":      "reader@example.com",
		"password":   "password123",
		"firstName":  "Test",
		"lastName":   "User",
		"nickname":   "tester",
	})
	if registerResp.Code != http.StatusCreated {
		t.Fatalf("register failed: %s", registerResp.Body.String())
	}

	var registerBody struct {
		UserID string `json:"userId"`
	}
	if err := json.Unmarshal(registerResp.Body.Bytes(), &registerBody); err != nil {
		t.Fatalf("parse register body: %v", err)
	}

	loginResp := doReq(t, r, http.MethodPost, "/api/v1/auth/login", map[string]string{
		"email":    "reader@example.com",
		"password": "password123",
	})
	if loginResp.Code != http.StatusOK {
		t.Fatalf("login failed: %s", loginResp.Body.String())
	}

	var loginBody struct {
		AccessToken string `json:"accessToken"`
	}
	if err := json.Unmarshal(loginResp.Body.Bytes(), &loginBody); err != nil {
		t.Fatalf("parse login body: %v", err)
	}

	saveResp := doReqAuth(t, r, http.MethodPost, "/api/v1/user/preferences", map[string]any{
		"genres": []string{"history"},
	}, loginBody.AccessToken)
	if saveResp.Code != http.StatusOK {
		t.Fatalf("save preferences failed: %s", saveResp.Body.String())
	}

	getResp := doReqAuth(t, r, http.MethodGet, "/api/v1/user/"+registerBody.UserID+"/preferences", nil, loginBody.AccessToken)
	if getResp.Code != http.StatusOK {
		t.Fatalf("get preferences failed: %s", getResp.Body.String())
	}
}
