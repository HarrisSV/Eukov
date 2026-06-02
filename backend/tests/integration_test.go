package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/eukov/backend/internal/api"
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
		`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL, created_at DATETIME, updated_at DATETIME);`,
		`CREATE TABLE genres (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);`,
		`CREATE TABLE user_genres (user_id TEXT NOT NULL, genre_id TEXT NOT NULL, PRIMARY KEY (user_id, genre_id));`,
		`CREATE TABLE dockets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, created_at DATETIME);`,
		`CREATE TABLE documents (id TEXT PRIMARY KEY, docket_id TEXT NOT NULL, title TEXT NOT NULL, file_path TEXT NOT NULL, status TEXT NOT NULL, created_at DATETIME);`,
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
	prefRepo := repository.NewPreferenceRepository(db)

	h := api.NewHandler(
		service.NewUserService(userRepo),
		service.NewGenreService(genreRepo),
		service.NewPreferenceService(userRepo, genreRepo, prefRepo),
		service.NewStorageService(t.TempDir()),
	)

	r := gin.New()
	h.RegisterRoutes(r)
	return r
}

func doReq(t *testing.T, r *gin.Engine, method, url string, body any) *httptest.ResponseRecorder {
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
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

func TestIntegration_RegisterLoginPreferencesFlow(t *testing.T) {
	r := setupIntegrationRouter(t)

	registerResp := doReq(t, r, http.MethodPost, "/api/v1/auth/register", map[string]string{
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
		t.Fatalf("parse register body: %v", err)
	}

	loginResp := doReq(t, r, http.MethodPost, "/api/v1/auth/login", map[string]string{
		"email":    "reader@example.com",
		"password": "password123",
	})
	if loginResp.Code != http.StatusOK {
		t.Fatalf("login failed: %s", loginResp.Body.String())
	}

	saveResp := doReq(t, r, http.MethodPost, "/api/v1/user/preferences", map[string]any{
		"userId": registerBody.UserID,
		"genres": []string{"history", "science"},
	})
	if saveResp.Code != http.StatusOK {
		t.Fatalf("save preferences failed: %s", saveResp.Body.String())
	}
}
