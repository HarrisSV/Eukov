package api

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/roles"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func seedUser(t *testing.T, db *gorm.DB, email, password, role string) uuid.UUID {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	user := models.User{
		ID:           uuid.New(),
		Email:        email,
		PasswordHash: string(hash),
		Role:         role,
		TokenVersion: 1,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	return user.ID
}

func TestLoginReturnsTokens(t *testing.T) {
	r, _ := setupTestHandler(t)
	_ = doJSONRequest(t, r, http.MethodPost, "/api/v1/auth/register", testRegisterBody("reader@example.com", "password123"))

	resp := doJSONRequest(t, r, http.MethodPost, "/api/v1/auth/login", map[string]string{
		"email": "reader@example.com", "password": "password123",
	})
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", resp.Code, resp.Body.String())
	}

	var body struct {
		AccessToken  string `json:"accessToken"`
		RefreshToken string `json:"refreshToken"`
		User         struct {
			Role string `json:"role"`
		} `json:"user"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse: %v", err)
	}
	if body.AccessToken == "" || body.RefreshToken == "" {
		t.Fatal("expected tokens in login response")
	}
	if body.User.Role != roles.Reader {
		t.Fatalf("expected READER role, got %s", body.User.Role)
	}
}

func TestRefreshAndLogout(t *testing.T) {
	r, _ := setupTestHandler(t)
	_ = doJSONRequest(t, r, http.MethodPost, "/api/v1/auth/register", testRegisterBody("reader@example.com", "password123"))
	loginResp := doJSONRequest(t, r, http.MethodPost, "/api/v1/auth/login", map[string]string{
		"email": "reader@example.com", "password": "password123",
	})
	var loginBody struct {
		AccessToken  string `json:"accessToken"`
		RefreshToken string `json:"refreshToken"`
	}
	_ = json.Unmarshal(loginResp.Body.Bytes(), &loginBody)

	refreshResp := doJSONRequest(t, r, http.MethodPost, "/api/v1/auth/refresh", map[string]string{
		"refreshToken": loginBody.RefreshToken,
	})
	if refreshResp.Code != http.StatusOK {
		t.Fatalf("refresh failed: %s", refreshResp.Body.String())
	}

	logoutResp := doJSONRequestWithToken(t, r, http.MethodPost, "/api/v1/auth/logout", map[string]string{
		"refreshToken": loginBody.RefreshToken,
	}, loginBody.AccessToken)
	if logoutResp.Code != http.StatusOK {
		t.Fatalf("logout failed: %s", logoutResp.Body.String())
	}
}

func TestAuthorApplicationWorkflow(t *testing.T) {
	r, db := setupTestHandler(t)
	readerID := seedUser(t, db, "reader@example.com", "password123", roles.Reader)
	adminID := seedUser(t, db, "admin@example.com", "password123", roles.Admin)

	readerToken := loginAndGetAccessToken(t, r, "reader@example.com", "password123")
	adminToken := loginAndGetAccessToken(t, r, "admin@example.com", "password123")

	submitResp := doJSONRequestWithToken(t, r, http.MethodPost, "/api/v1/author-applications", map[string]string{
		"qualifications": "Published essays in national journals",
		"experience":     "Five years writing political commentary",
	}, readerToken)
	if submitResp.Code != http.StatusCreated {
		t.Fatalf("submit failed: %s", submitResp.Body.String())
	}
	var submitBody struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(submitResp.Body.Bytes(), &submitBody); err != nil {
		t.Fatalf("parse submit response: %v", err)
	}

	listResp := doJSONRequestWithToken(t, r, http.MethodGet, "/api/v1/admin/author-applications", nil, adminToken)
	if listResp.Code != http.StatusOK {
		t.Fatalf("list failed: %s", listResp.Body.String())
	}

	approveResp := doJSONRequestWithToken(t, r, http.MethodPost, "/api/v1/admin/author-applications/"+submitBody.ID+"/approve", nil, adminToken)
	if approveResp.Code != http.StatusOK {
		t.Fatalf("approve failed: %s", approveResp.Body.String())
	}

	var user models.User
	if err := db.Where("id = ?", readerID).First(&user).Error; err != nil {
		t.Fatalf("load reader: %v", err)
	}
	if user.Role != roles.Author {
		t.Fatalf("expected AUTHOR role, got %s", user.Role)
	}
	_ = adminID
}

func TestAccessKeyPromotion(t *testing.T) {
	r, db := setupTestHandler(t)
	_ = seedUser(t, db, "super@example.com", "password123", roles.SuperAdmin)
	readerID := seedUser(t, db, "reader@example.com", "password123", roles.Reader)

	superToken := loginAndGetAccessToken(t, r, "super@example.com", "password123")
	readerToken := loginAndGetAccessToken(t, r, "reader@example.com", "password123")

	genResp := doJSONRequestWithToken(t, r, http.MethodPost, "/api/v1/access-keys", nil, superToken)
	if genResp.Code != http.StatusCreated {
		t.Fatalf("generate key failed: %s", genResp.Body.String())
	}
	var genBody struct {
		AccessKey string `json:"accessKey"`
	}
	_ = json.Unmarshal(genResp.Body.Bytes(), &genBody)

	consumeResp := doJSONRequestWithToken(t, r, http.MethodPost, "/api/v1/access-keys/consume", map[string]string{
		"accessKey": genBody.AccessKey,
	}, readerToken)
	if consumeResp.Code != http.StatusOK {
		t.Fatalf("consume failed: %s", consumeResp.Body.String())
	}

	var user models.User
	if err := db.Where("id = ?", readerID).First(&user).Error; err != nil {
		t.Fatalf("load reader: %v", err)
	}
	if user.Role != roles.Admin {
		t.Fatalf("expected ADMIN role, got %s", user.Role)
	}
}
