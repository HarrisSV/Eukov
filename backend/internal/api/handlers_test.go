package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/repository"
	"github.com/eukov/backend/internal/service"
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

	userRepo := repository.NewUserRepository(db)
	genreRepo := repository.NewGenreRepository(db)
	prefRepo := repository.NewPreferenceRepository(db)

	userSvc := service.NewUserService(userRepo)
	genreSvc := service.NewGenreService(genreRepo)
	prefSvc := service.NewPreferenceService(userRepo, genreRepo, prefRepo)
	storageSvc := service.NewStorageService(t.TempDir())
	if err := storageSvc.EnsureDirectories(); err != nil {
		t.Fatalf("ensure directories: %v", err)
	}

	h := NewHandler(userSvc, genreSvc, prefSvc, storageSvc)
	r := gin.New()
	h.RegisterRoutes(r)

	return r, db
}

func createSQLiteSchema(t *testing.T, db *gorm.DB) {
	t.Helper()
	stmts := []string{
		`CREATE TABLE users (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			role TEXT NOT NULL,
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
			title TEXT NOT NULL,
			file_path TEXT NOT NULL,
			status TEXT NOT NULL,
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
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)
	return resp
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

	saveResp := doJSONRequest(t, r, http.MethodPost, "/api/v1/user/preferences", map[string]any{
		"userId": registerBody.UserID,
		"genres": []string{"history", "science"},
	})
	if saveResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", saveResp.Code, saveResp.Body.String())
	}

	getResp := doJSONRequest(t, r, http.MethodGet, "/api/v1/user/"+registerBody.UserID+"/preferences", nil)
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

	invalidBodyResp := doJSONRequest(t, r, http.MethodPost, "/api/v1/user/preferences", map[string]any{
		"userId": "not-a-uuid",
		"genres": []string{},
	})
	if invalidBodyResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid payload, got %d", invalidBodyResp.Code)
	}

	missingUserResp := doJSONRequest(t, r, http.MethodPost, "/api/v1/user/preferences", map[string]any{
		"userId": uuid.NewString(),
		"genres": []string{"history"},
	})
	if missingUserResp.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for missing user, got %d", missingUserResp.Code)
	}

	registerResp := doJSONRequest(t, r, http.MethodPost, "/api/v1/auth/register", map[string]string{
		"email":    "reader@example.com",
		"password": "password123",
	})
	var registerBody struct {
		UserID string `json:"userId"`
	}
	if err := json.Unmarshal(registerResp.Body.Bytes(), &registerBody); err != nil {
		t.Fatalf("parse register response: %v", err)
	}

	badGenreResp := doJSONRequest(t, r, http.MethodPost, "/api/v1/user/preferences", map[string]any{
		"userId": registerBody.UserID,
		"genres": []string{"nonexistent"},
	})
	if badGenreResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid genres, got %d", badGenreResp.Code)
	}
}

func TestGetPreferencesValidation(t *testing.T) {
	r, _ := setupTestHandler(t)
	resp := doJSONRequest(t, r, http.MethodGet, "/api/v1/user/not-a-uuid/preferences", nil)
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
	if prefResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid preferences JSON, got %d", prefResp.Code)
	}
}
