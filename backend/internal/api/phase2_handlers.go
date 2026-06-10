package api

import (
	"errors"
	"net/http"
	"time"

	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/middleware"
	"github.com/eukov/backend/internal/repository"
	"github.com/eukov/backend/internal/roles"
	"github.com/eukov/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type tokenResponse struct {
	AccessToken  string             `json:"accessToken"`
	RefreshToken string             `json:"refreshToken"`
	User         userProfileResponse `json:"user"`
}

type userProfileResponse struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

func toProfile(p service.UserProfile) userProfileResponse {
	return userProfileResponse{
		ID:    p.ID.String(),
		Email: p.Email,
		Role:  p.Role,
	}
}

type refreshRequest struct {
	RefreshToken string `json:"refreshToken" validate:"required"`
}

type logoutRequest struct {
	RefreshToken string `json:"refreshToken"`
}

func (h *Handler) Login(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if err := h.validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.users.Login(c.Request.Context(), service.LoginInput{
		Email:    req.Email,
		Password: req.Password,
	})
	if err != nil {
		if errors.Is(err, service.ErrInvalidCredentials) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "login failed"})
		return
	}

	user, err := h.users.FindByID(c.Request.Context(), result.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "login failed"})
		return
	}

	session, err := h.sessions.IssueTokens(c.Request.Context(), user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "login failed"})
		return
	}

	c.JSON(http.StatusOK, tokenResponse{
		AccessToken:  session.Tokens.AccessToken,
		RefreshToken: session.Tokens.RefreshToken,
		User:         toProfile(session.Profile),
	})
}

func (h *Handler) Refresh(c *gin.Context) {
	var req refreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if err := h.validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	session, err := h.sessions.Refresh(c.Request.Context(), req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid refresh token"})
		return
	}

	c.JSON(http.StatusOK, tokenResponse{
		AccessToken:  session.Tokens.AccessToken,
		RefreshToken: session.Tokens.RefreshToken,
		User:         toProfile(session.Profile),
	})
}

func (h *Handler) Logout(c *gin.Context) {
	user, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req logoutRequest
	_ = c.ShouldBindJSON(&req)

	if err := h.sessions.Logout(c.Request.Context(), user.ID, req.RefreshToken); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "logout failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) Me(c *gin.Context) {
	user, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	c.JSON(http.StatusOK, userProfileResponse{
		ID:    user.ID.String(),
		Email: user.Email,
		Role:  user.Role,
	})
}

type generateAccessKeyResponse struct {
	KeyID     string    `json:"keyId"`
	AccessKey string    `json:"accessKey"`
	ExpiresAt time.Time `json:"expiresAt"`
}

func (h *Handler) GenerateAccessKey(c *gin.Context) {
	user, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	result, err := h.accessKeys.Generate(c.Request.Context(), user.ID, 7*24*time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate access key"})
		return
	}

	c.JSON(http.StatusCreated, generateAccessKeyResponse{
		KeyID:     result.KeyID.String(),
		AccessKey: result.PlainKey,
		ExpiresAt: result.ExpiresAt,
	})
}

type consumeAccessKeyRequest struct {
	AccessKey string `json:"accessKey" validate:"required,min=16"`
}

func (h *Handler) ConsumeAccessKey(c *gin.Context) {
	user, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req consumeAccessKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if err := h.validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.accessKeys.Consume(c.Request.Context(), user.ID, req.AccessKey); err != nil {
		if errors.Is(err, service.ErrAccessKeyInvalid) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired access key"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "role": roles.Admin})
}

type submitAuthorApplicationRequest struct {
	Qualifications string `json:"qualifications" validate:"required,min=10"`
	Experience     string `json:"experience" validate:"required,min=10"`
}

func (h *Handler) SubmitAuthorApplication(c *gin.Context) {
	user, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req submitAuthorApplicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if err := h.validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	app, err := h.authorApps.Submit(c.Request.Context(), service.SubmitApplicationInput{
		UserID:         user.ID,
		Qualifications: req.Qualifications,
		Experience:     req.Experience,
	})
	if err != nil {
		if errors.Is(err, repository.ErrApplicationExists) {
			c.JSON(http.StatusConflict, gin.H{"error": "pending application already exists"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":     app.ID.String(),
		"status": app.Status,
	})
}

func (h *Handler) ListAuthorApplications(c *gin.Context) {
	status := c.DefaultQuery("status", "PENDING")
	var apps []models.AuthorApplication
	var err error
	if status == "PENDING" {
		apps, err = h.authorApps.ListPending(c.Request.Context())
	} else {
		apps, err = h.authorApps.ListByStatus(c.Request.Context(), status)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list applications"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"applications": apps})
}

func (h *Handler) ApproveAuthorApplication(c *gin.Context) {
	h.reviewAuthorApplication(c, true)
}

func (h *Handler) RejectAuthorApplication(c *gin.Context) {
	h.reviewAuthorApplication(c, false)
}

func (h *Handler) reviewAuthorApplication(c *gin.Context, approve bool) {
	reviewer, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	applicationID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid application id"})
		return
	}

	var reviewErr error
	if approve {
		reviewErr = h.authorApps.Approve(c.Request.Context(), applicationID, reviewer.ID)
	} else {
		reviewErr = h.authorApps.Reject(c.Request.Context(), applicationID, reviewer.ID)
	}
	if reviewErr != nil {
		if errors.Is(reviewErr, service.ErrApplicationNotPending) {
			c.JSON(http.StatusConflict, gin.H{"error": "application is not pending"})
			return
		}
		if errors.Is(reviewErr, repository.ErrApplicationNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "application not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "review failed"})
		return
	}

	status := "REJECTED"
	if approve {
		status = "APPROVED"
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "status": status})
}

func (h *Handler) ListAuditLogs(c *gin.Context) {
	logs, err := h.audit.ListRecent(c.Request.Context(), 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch audit logs"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"logs": logs})
}
