package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/eukov/backend/internal/auth"
	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/repository"
	"github.com/eukov/backend/internal/service"
	"github.com/eukov/backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestHandler(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "test.db")), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	createSQLiteSchema(t, db)

	seedGenres := []models.Genre{
		{ID: uuid.New(), Name: "philosophy"},
		{ID: uuid.New(), Name: "history"},
		{ID: uuid.New(), Name: "politics"},
		{ID: uuid.New(), Name: "literature"},
		{ID: uuid.New(), Name: "economics"},
		{ID: uuid.New(), Name: "psychology"},
		{ID: uuid.New(), Name: "technology"},
		{ID: uuid.New(), Name: "science"},
	}
	if err := db.Create(&seedGenres).Error; err != nil {
		t.Fatalf("seed genres: %v", err)
	}

	r := setupRouterFromDB(t, db)
	return r, db
}

func setupRouterFromDB(t *testing.T, db *gorm.DB) *gin.Engine {
	t.Helper()

	userRepo := repository.NewUserRepository(db)
	genreRepo := repository.NewGenreRepository(db)
	prefRepo := repository.NewPreferenceRepository(db)
	accessKeyRepo := repository.NewAccessKeyRepository(db)
	authorAppRepo := repository.NewAuthorApplicationRepository(db)
	auditRepo := repository.NewAuditLogRepository(db)
	refreshRepo := repository.NewRefreshTokenRepository(db)

	jwtSvc := auth.NewJWTService("test-secret-key-32chars-minimum!", 15, 7)
	userSvc := service.NewUserService(userRepo)
	genreSvc := service.NewGenreService(genreRepo)
	prefSvc := service.NewPreferenceService(userRepo, genreRepo, prefRepo)
	storageSvc := service.NewStorageService(t.TempDir())
	if err := storageSvc.EnsureDirectories(); err != nil {
		t.Fatalf("ensure directories: %v", err)
	}
	sessionSvc := service.NewAuthSessionService(userRepo, refreshRepo, jwtSvc)
	auditSvc := service.NewAuditService(auditRepo)
	accessKeySvc := service.NewAccessKeyService(accessKeyRepo, userRepo, auditSvc)
	authorAppSvc := service.NewAuthorApplicationService(authorAppRepo, userRepo, auditSvc)
	documentSvc := newTestDocumentService(t, db, auditSvc)
	docketSvc := newTestDocketService(db)
	adminActivitySvc := newTestAdminActivityService(db)

	h := NewHandler(userSvc, genreSvc, prefSvc, storageSvc, sessionSvc, accessKeySvc, authorAppSvc, auditSvc, documentSvc, docketSvc, adminActivitySvc)
	r := gin.New()
	authLimiter := middleware.NewRateLimiter(1000, time.Minute)
	h.RegisterRoutes(r, jwtSvc, authLimiter)
	return r
}

func newTestDocumentService(t *testing.T, db *gorm.DB, auditSvc *service.AuditService) *service.DocumentService {
	return service.NewDocumentService(
		repository.NewDocketRepository(db),
		repository.NewDocumentRepository(db),
		repository.NewDocumentTagRepository(db),
		repository.NewGenreRepository(db),
		repository.NewDocumentMetadataRepository(db),
		repository.NewDocketItemRepository(db),
		service.NewDocumentFileService(t.TempDir()),
		repository.NewUnpublishRepository(db),
		repository.NewPublishAuditEventRepository(db),
		auditSvc,
	)
}

func newTestDocketService(db *gorm.DB) *service.DocketService {
	return service.NewDocketService(
		repository.NewDocketItemRepository(db),
		repository.NewDocumentRepository(db),
		repository.NewDocumentTagRepository(db),
		repository.NewGenreRepository(db),
		repository.NewDocumentMetadataRepository(db),
	)
}

func newTestAdminActivityService(db *gorm.DB) *service.AdminActivityService {
	return service.NewAdminActivityService(
		repository.NewUserRepository(db),
		repository.NewDocumentRepository(db),
		repository.NewPublishAuditEventRepository(db),
		repository.NewUnpublishRepository(db),
	)
}

func createSQLiteSchema(t *testing.T, db *gorm.DB) {
	t.Helper()
	stmts := []string{
		`CREATE TABLE users (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			role TEXT NOT NULL,
			token_version INTEGER NOT NULL DEFAULT 1,
			created_at DATETIME,
			updated_at DATETIME
		);`,
		`CREATE TABLE genres (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL UNIQUE
		);`,
		`CREATE TABLE user_genres (
			user_id TEXT NOT NULL,
			genre_id TEXT NOT NULL,
			PRIMARY KEY (user_id, genre_id)
		);`,
		`CREATE TABLE dockets (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			name TEXT NOT NULL,
			created_at DATETIME
		);`,
		`CREATE TABLE documents (
			id TEXT PRIMARY KEY,
			docket_id TEXT NOT NULL,
			author_id TEXT NOT NULL,
			title TEXT NOT NULL,
			file_path TEXT NOT NULL,
			status TEXT NOT NULL,
			genre_id TEXT,
			published_at DATETIME,
			created_at DATETIME,
			updated_at DATETIME
		);`,
		`CREATE TABLE document_tags (
			id TEXT PRIMARY KEY,
			document_id TEXT NOT NULL,
			tag TEXT NOT NULL,
			created_at DATETIME
		);`,
		`CREATE TABLE unpublish_requests (
			id TEXT PRIMARY KEY,
			document_id TEXT NOT NULL,
			author_id TEXT NOT NULL,
			status TEXT NOT NULL,
			justification TEXT NOT NULL,
			actioned_by TEXT,
			actioned_at DATETIME,
			created_at DATETIME,
			updated_at DATETIME
		);`,
		`CREATE TABLE document_metadata (
			id TEXT PRIMARY KEY,
			document_id TEXT NOT NULL UNIQUE,
			genre_id TEXT NOT NULL,
			summary TEXT NOT NULL DEFAULT '',
			reading_time INTEGER NOT NULL DEFAULT 0,
			created_at DATETIME
		);`,
		`CREATE TABLE docket_items (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			item_type TEXT NOT NULL,
			item_id TEXT NOT NULL,
			saved_at DATETIME
		);`,
		`CREATE TABLE publish_audit_events (
			id TEXT PRIMARY KEY,
			document_id TEXT,
			actor_id TEXT,
			event_type TEXT NOT NULL,
			metadata TEXT NOT NULL DEFAULT '{}',
			created_at DATETIME
		);`,
		`CREATE TABLE access_keys (
			id TEXT PRIMARY KEY,
			key_hash TEXT NOT NULL,
			created_by TEXT NOT NULL,
			consumed_by TEXT,
			expires_at DATETIME NOT NULL,
			consumed_at DATETIME,
			status TEXT NOT NULL,
			created_at DATETIME
		);`,
		`CREATE TABLE author_applications (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			qualifications TEXT NOT NULL,
			experience TEXT NOT NULL,
			status TEXT NOT NULL,
			reviewed_by TEXT,
			reviewed_at DATETIME,
			created_at DATETIME,
			updated_at DATETIME
		);`,
		`CREATE TABLE audit_logs (
			id TEXT PRIMARY KEY,
			actor_id TEXT,
			action TEXT NOT NULL,
			entity_type TEXT NOT NULL,
			entity_id TEXT,
			metadata TEXT NOT NULL DEFAULT '{}',
			created_at DATETIME
		);`,
		`CREATE TABLE refresh_tokens (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			token_hash TEXT NOT NULL UNIQUE,
			expires_at DATETIME NOT NULL,
			created_at DATETIME
		);`,
	}

	for _, stmt := range stmts {
		if err := db.Exec(stmt).Error; err != nil {
			t.Fatalf("create sqlite schema: %v", err)
		}
	}
}

func doJSONRequest(t *testing.T, r *gin.Engine, method, path string, body any) *httptest.ResponseRecorder {
	return doJSONRequestWithToken(t, r, method, path, body, "")
}

func doJSONRequestWithToken(t *testing.T, r *gin.Engine, method, path string, body any, token string) *httptest.ResponseRecorder {
	t.Helper()
	var payload []byte
	var err error
	if body != nil {
		payload, err = json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
	}

	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)
	return resp
}

func loginAndGetAccessToken(t *testing.T, r *gin.Engine, email, password string) string {
	t.Helper()
	resp := doJSONRequest(t, r, http.MethodPost, "/api/v1/auth/login", map[string]string{
		"email":    email,
		"password": password,
	})
	if resp.Code != http.StatusOK {
		t.Fatalf("login failed: %s", resp.Body.String())
	}
	var body struct {
		AccessToken string `json:"accessToken"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse login: %v", err)
	}
	return body.AccessToken
}

func doRawRequest(r *gin.Engine, method, path string, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)
	return resp
}

func TestHealth(t *testing.T) {
	r, _ := setupTestHandler(t)
	resp := doJSONRequest(t, r, http.MethodGet, "/api/v1/health", nil)
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}
}

func TestRegisterAndLogin(t *testing.T) {
	r, _ := setupTestHandler(t)

	registerResp := doJSONRequest(t, r, http.MethodPost, "/api/v1/auth/register", map[string]string{
		"email":    "reader@example.com",
		"password": "password123",
	})
	if registerResp.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body=%s", registerResp.Code, registerResp.Body.String())
	}

	loginResp := doJSONRequest(t, r, http.MethodPost, "/api/v1/auth/login", map[string]string{
		"email":    "reader@example.com",
		"password": "password123",
	})
	if loginResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", loginResp.Code, loginResp.Body.String())
	}
}

func TestRegisterValidation(t *testing.T) {
	r, _ := setupTestHandler(t)

	resp := doJSONRequest(t, r, http.MethodPost, "/api/v1/auth/register", map[string]string{
		"email":    "not-an-email",
		"password": "123",
	})
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.Code)
	}
}

func TestRegisterDuplicateEmail(t *testing.T) {
	r, _ := setupTestHandler(t)
	body := map[string]string{"email": "reader@example.com", "password": "password123"}
	resp1 := doJSONRequest(t, r, http.MethodPost, "/api/v1/auth/register", body)
	if resp1.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", resp1.Code)
	}
	resp2 := doJSONRequest(t, r, http.MethodPost, "/api/v1/auth/register", body)
	if resp2.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d body=%s", resp2.Code, resp2.Body.String())
	}
}

func TestLoginInvalidCredentials(t *testing.T) {
	r, _ := setupTestHandler(t)

	_ = doJSONRequest(t, r, http.MethodPost, "/api/v1/auth/register", map[string]string{
		"email":    "reader@example.com",
		"password": "password123",
	})

	resp := doJSONRequest(t, r, http.MethodPost, "/api/v1/auth/login", map[string]string{
		"email":    "reader@example.com",
		"password": "wrong-pass",
	})
	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.Code)
	}
}

func TestLoginValidation(t *testing.T) {
	r, _ := setupTestHandler(t)
	resp := doJSONRequest(t, r, http.MethodPost, "/api/v1/auth/login", map[string]string{
		"email":    "invalid",
		"password": "123",
	})
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.Code)
	}
}

func TestGenresAndPreferences(t *testing.T) {
	r, db := setupTestHandler(t)
	registerResp := doJSONRequest(t, r, http.MethodPost, "/api/v1/auth/register", map[string]string{
		"email":    "reader@example.com",
		"password": "password123",
	})
	if registerResp.Code != http.StatusCreated {
		t.Fatalf("register failed: %s", registerResp.Body.String())
	}

	var registerBody struct {
		UserID string `json:"userId"`
	}
	if err := json.Unmarshal(registerResp.Body.Bytes(), &registerBody); err != nil {
		t.Fatalf("unmarshal register body: %v", err)
	}

	genresResp := doJSONRequest(t, r, http.MethodGet, "/api/v1/genres", nil)
	if genresResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", genresResp.Code)
	}

	token := loginAndGetAccessToken(t, r, "reader@example.com", "password123")

	saveResp := doJSONRequestWithToken(t, r, http.MethodPost, "/api/v1/user/preferences", map[string]any{
		"genres": []string{"history", "science"},
	}, token)
	if saveResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", saveResp.Code, saveResp.Body.String())
	}

	getResp := doJSONRequestWithToken(t, r, http.MethodGet, "/api/v1/user/"+registerBody.UserID+"/preferences", nil, token)
	if getResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", getResp.Code)
	}

	var count int64
	if err := db.WithContext(context.Background()).Table("user_genres").Count(&count).Error; err != nil {
		t.Fatalf("count user_genres: %v", err)
	}
	if count != 2 {
		t.Fatalf("expected 2 user_genres records, got %d", count)
	}
}

func TestSavePreferencesValidationAndErrors(t *testing.T) {
	r, _ := setupTestHandler(t)

	unauthResp := doJSONRequest(t, r, http.MethodPost, "/api/v1/user/preferences", map[string]any{
		"genres": []string{"history"},
	})
	if unauthResp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without token, got %d", unauthResp.Code)
	}

	_ = doJSONRequest(t, r, http.MethodPost, "/api/v1/auth/register", map[string]string{
		"email":    "reader@example.com",
		"password": "password123",
	})
	token := loginAndGetAccessToken(t, r, "reader@example.com", "password123")

	invalidBodyResp := doJSONRequestWithToken(t, r, http.MethodPost, "/api/v1/user/preferences", map[string]any{
		"genres": []string{},
	}, token)
	if invalidBodyResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid payload, got %d", invalidBodyResp.Code)
	}

	badGenreResp := doJSONRequestWithToken(t, r, http.MethodPost, "/api/v1/user/preferences", map[string]any{
		"genres": []string{"nonexistent"},
	}, token)
	if badGenreResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid genres, got %d", badGenreResp.Code)
	}
}

func TestGetPreferencesValidation(t *testing.T) {
	r, _ := setupTestHandler(t)
	_ = doJSONRequest(t, r, http.MethodPost, "/api/v1/auth/register", map[string]string{
		"email":    "reader@example.com",
		"password": "password123",
	})
	token := loginAndGetAccessToken(t, r, "reader@example.com", "password123")
	resp := doJSONRequestWithToken(t, r, http.MethodGet, "/api/v1/user/not-a-uuid/preferences", nil, token)
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid user id, got %d", resp.Code)
	}
}

func TestInvalidJSONBodies(t *testing.T) {
	r, _ := setupTestHandler(t)

	registerResp := doRawRequest(r, http.MethodPost, "/api/v1/auth/register", "{")
	if registerResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid register JSON, got %d", registerResp.Code)
	}

	loginResp := doRawRequest(r, http.MethodPost, "/api/v1/auth/login", "{")
	if loginResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid login JSON, got %d", loginResp.Code)
	}

	prefResp := doRawRequest(r, http.MethodPost, "/api/v1/user/preferences", "{")
	if prefResp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated preferences request, got %d", prefResp.Code)
	}
}
