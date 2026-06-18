package api

import (
	"errors"
	"net/http"

	"github.com/eukov/backend/internal/auth"
	"github.com/eukov/backend/internal/middleware"
	"github.com/eukov/backend/internal/repository"
	"github.com/eukov/backend/internal/roles"
	"github.com/eukov/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
)

type Handler struct {
	users           *service.UserService
	genres          *service.GenreService
	preferences     *service.PreferenceService
	storage         *service.StorageService
	sessions        *service.AuthSessionService
	accessKeys      *service.AccessKeyService
	authorApps      *service.AuthorApplicationService
	audit           *service.AuditService
	inbox           *service.InboxService
	documents       *service.DocumentService
	docket          *service.DocketService
	adminActivity   *service.AdminActivityService
	library         *service.LibraryService
	recommendations *service.RecommendationService
	subscriptions   *service.SubscriptionService
	issuance        *service.IssuanceService
	progress        *service.ProgressService
	reading         *service.ReadingService
	validate        *validator.Validate
}

func NewHandler(
	users *service.UserService,
	genres *service.GenreService,
	preferences *service.PreferenceService,
	storage *service.StorageService,
	sessions *service.AuthSessionService,
	accessKeys *service.AccessKeyService,
	authorApps *service.AuthorApplicationService,
	audit *service.AuditService,
	inbox *service.InboxService,
	documents *service.DocumentService,
	docket *service.DocketService,
	adminActivity *service.AdminActivityService,
	library *service.LibraryService,
	recommendations *service.RecommendationService,
	subscriptions *service.SubscriptionService,
	issuance *service.IssuanceService,
	progress *service.ProgressService,
	reading *service.ReadingService,
) *Handler {
	return &Handler{
		users:           users,
		genres:          genres,
		preferences:     preferences,
		storage:         storage,
		sessions:        sessions,
		accessKeys:      accessKeys,
		authorApps:      authorApps,
		audit:           audit,
		inbox:           inbox,
		documents:       documents,
		docket:          docket,
		adminActivity:   adminActivity,
		library:         library,
		recommendations: recommendations,
		subscriptions:   subscriptions,
		issuance:        issuance,
		progress:        progress,
		reading:         reading,
		validate:        validator.New(),
	}
}

func (h *Handler) RegisterRoutes(r *gin.Engine, jwtSvc *auth.JWTService, authLimiter *middleware.RateLimiter) {
	v1 := r.Group("/api/v1")
	{
		v1.GET("/health", h.Health)
		v1.POST("/auth/register", authLimiter.Middleware(), h.Register)
		v1.POST("/auth/login", authLimiter.Middleware(), h.Login)
		v1.POST("/auth/refresh", authLimiter.Middleware(), h.Refresh)
		v1.GET("/genres", h.GetGenres)

		protected := v1.Group("")
		protected.Use(middleware.Authenticate(h.sessions, jwtSvc))
		{
			protected.POST("/auth/logout", h.Logout)
			protected.GET("/auth/me", h.Me)
			protected.POST("/user/preferences", h.SavePreferences)
			protected.GET("/user/:userId/preferences", h.GetPreferences)

			reader := protected.Group("")
			reader.Use(middleware.RequireRole(roles.Reader))
			reader.POST("/author-applications", h.SubmitAuthorApplication)
			reader.POST("/author-applications/request", h.SubmitAuthorApplicationMultipart)
			reader.GET("/author-applications/mine", h.GetMyAuthorApplication)
			reader.GET("/author-applications/attachments/:attachmentId", h.DownloadAuthorApplicationAttachment)
			reader.GET("/inbox", h.ListInbox)
			reader.PATCH("/inbox/:id/read", h.MarkInboxRead)
			reader.POST("/access-keys/consume", h.ConsumeAccessKey)
			reader.GET("/docket", h.GetDocketWorkspace)
			reader.GET("/docket/books", h.GetDocketBooks)
			reader.GET("/library", h.GetLibrary)
			reader.GET("/library/recommended", h.GetRecommendedLibrary)
			reader.POST("/authors/:id/subscribe", h.SubscribeAuthor)
			reader.DELETE("/authors/:id/unsubscribe", h.UnsubscribeAuthor)
			reader.POST("/documents/:id/issue", h.IssueBook)
			reader.GET("/documents/:id/preview", h.GetDocumentPreview)
			reader.GET("/documents/:id/pages/:page", h.GetDocumentPage)
			reader.POST("/progress", h.SaveProgress)

			admin := protected.Group("/admin")
			admin.Use(middleware.RequireRole(roles.Admin))
			admin.GET("/author-applications", h.ListAuthorApplications)
			admin.POST("/author-applications/:id/reply", h.ReplyAuthorApplication)
			admin.POST("/author-applications/:id/approve", h.ApproveAuthorApplication)
			admin.POST("/author-applications/:id/reject", h.RejectAuthorApplication)
			admin.GET("/unpublish-queue", h.ListUnpublishRequests)
			admin.POST("/unpublish-queue/:id/approve", h.ApproveUnpublishRequest)
			admin.POST("/unpublish-queue/:id/reject", h.RejectUnpublishRequest)
			admin.GET("/author-activity", h.GetAdminAuthorActivity)

			author := protected.Group("")
			author.Use(middleware.RequireRole(roles.Author))
			author.POST("/documents", h.CreateDocument)
			author.PUT("/documents/:id", h.UpdateDocument)
			author.DELETE("/documents/:id", h.DeleteDocument)
			author.POST("/documents/:id/publish", h.PublishDocument)
			author.POST("/documents/:id/unpublish-request", h.SubmitUnpublishRequest)
			author.GET("/documents", h.ListDocuments)

			protected.GET("/documents/:id", h.GetDocument)
			protected.GET("/library/documents", h.ListDocuments)

			superAdmin := protected.Group("")
			superAdmin.Use(middleware.RequireRole(roles.SuperAdmin))
			superAdmin.POST("/access-keys", h.GenerateAccessKey)
			superAdmin.GET("/audit-logs", h.ListAuditLogs)
			superAdmin.POST("/admin/documents/:id/review", h.SuperAdminReviewDraft)
		}
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
	Email      string `json:"email" validate:"required,email"`
	Password   string `json:"password" validate:"required,min=8"`
	FirstName  string `json:"firstName" validate:"required"`
	MiddleName string `json:"middleName"`
	LastName   string `json:"lastName" validate:"required"`
	Nickname   string `json:"nickname" validate:"required"`
}

type loginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
}

type registerResponse struct {
	Success bool   `json:"success"`
	UserID  string `json:"userId"`
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
		Email:      req.Email,
		Password:   req.Password,
		FirstName:  req.FirstName,
		MiddleName: req.MiddleName,
		LastName:   req.LastName,
		Nickname:   req.Nickname,
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

func (h *Handler) GetGenres(c *gin.Context) {
	genres, err := h.genres.ListGenres(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch genres"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"genres": genres})
}

type preferencesRequest struct {
	UserID string   `json:"userId" validate:"omitempty,uuid"`
	Genres []string `json:"genres" validate:"required,min=1,dive,required"`
}

func (h *Handler) SavePreferences(c *gin.Context) {
	authUser, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req preferencesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if err := h.validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := authUser.ID
	if req.UserID != "" {
		parsed, err := uuid.Parse(req.UserID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
			return
		}
		if parsed != authUser.ID {
			c.JSON(http.StatusForbidden, gin.H{"error": "cannot modify another user's preferences"})
			return
		}
		userID = parsed
	}

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
