package api

import (
	"errors"
	"net/http"

	"github.com/eukov/backend/internal/repository"
	"github.com/eukov/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
)

type Handler struct {
	users       *service.UserService
	genres      *service.GenreService
	preferences *service.PreferenceService
	storage     *service.StorageService
	validate    *validator.Validate
}

func NewHandler(
	users *service.UserService,
	genres *service.GenreService,
	preferences *service.PreferenceService,
	storage *service.StorageService,
) *Handler {
	return &Handler{
		users:       users,
		genres:      genres,
		preferences: preferences,
		storage:     storage,
		validate:    validator.New(),
	}
}

func (h *Handler) RegisterRoutes(r *gin.Engine) {
	v1 := r.Group("/api/v1")
	{
		v1.GET("/health", h.Health)
		v1.POST("/auth/register", h.Register)
		v1.POST("/auth/login", h.Login)
		v1.GET("/genres", h.GetGenres)
		v1.POST("/user/preferences", h.SavePreferences)
		v1.GET("/user/:userId/preferences", h.GetPreferences)
	}
}

type healthResponse struct {
	Status string `json:"status"`
}

func (h *Handler) Health(c *gin.Context) {
	status := "healthy"
	if !h.storage.IsReady() {
		status = "degraded"
	}
	c.JSON(http.StatusOK, healthResponse{Status: status})
}

type registerRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
}

type registerResponse struct {
	Success bool   `json:"success"`
	UserID  string `json:"userId"`
}

type loginResponse struct {
	Success bool   `json:"success"`
	UserID  string `json:"userId"`
	Email   string `json:"email"`
}

func (h *Handler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if err := h.validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.users.Register(c.Request.Context(), service.RegisterInput{
		Email:    req.Email,
		Password: req.Password,
	})
	if err != nil {
		if errors.Is(err, repository.ErrUserAlreadyExists) {
			c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "registration failed"})
		return
	}

	c.JSON(http.StatusCreated, registerResponse{
		Success: true,
		UserID:  result.UserID.String(),
	})
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

	c.JSON(http.StatusOK, loginResponse{
		Success: true,
		UserID:  result.UserID.String(),
		Email:   result.Email,
	})
}

func (h *Handler) GetGenres(c *gin.Context) {
	genres, err := h.genres.ListGenres(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch genres"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"genres": genres})
}

type preferencesRequest struct {
	UserID string   `json:"userId" validate:"required,uuid"`
	Genres []string `json:"genres" validate:"required,min=1,dive,required"`
}

func (h *Handler) SavePreferences(c *gin.Context) {
	var req preferencesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if err := h.validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := uuid.Parse(req.UserID)

	if err := h.preferences.SavePreferences(c.Request.Context(), service.PreferencesInput{
		UserID: userID,
		Genres: req.Genres,
	}); err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		if errors.Is(err, repository.ErrGenreNotFound) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid genre selection"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save preferences"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) GetPreferences(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	genres, err := h.preferences.GetUserPreferences(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch preferences"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"genres": genres})
}
