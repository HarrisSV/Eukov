package api

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/eukov/backend/internal/middleware"
	"github.com/eukov/backend/internal/repository"
	"github.com/eukov/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (h *Handler) SubscribeAuthor(c *gin.Context) {
	user, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	authorID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid author id"})
		return
	}
	var body struct {
		DocumentID string `json:"documentId"`
	}
	_ = c.ShouldBindJSON(&body)
	var documentID *uuid.UUID
	if body.DocumentID != "" {
		parsed, parseErr := uuid.Parse(body.DocumentID)
		if parseErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid document id"})
			return
		}
		documentID = &parsed
	}
	sub, err := h.subscriptions.Subscribe(c.Request.Context(), user.ID, authorID, documentID)
	if err != nil {
		if errors.Is(err, repository.ErrAuthorSubscriptionExists) {
			c.JSON(http.StatusConflict, gin.H{"error": "already subscribed"})
			return
		}
		if errors.Is(err, service.ErrReaderNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "author not found"})
			return
		}
		if errors.Is(err, service.ErrReaderForbidden) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid author"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "subscription failed"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"subscription": sub})
}

func (h *Handler) UnsubscribeAuthor(c *gin.Context) {
	user, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	authorID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid author id"})
		return
	}
	if err := h.subscriptions.Unsubscribe(c.Request.Context(), user.ID, authorID); err != nil {
		if errors.Is(err, repository.ErrAuthorSubscriptionNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "subscription not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "unsubscribe failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) IssueBook(c *gin.Context) {
	user, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	documentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid document id"})
		return
	}
	book, err := h.issuance.Issue(c.Request.Context(), user.ID, documentID)
	if err != nil {
		if errors.Is(err, service.ErrReaderNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
			return
		}
		if errors.Is(err, service.ErrBookNotPublished) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "book is not published"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "issue failed"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"issuedBook": book})
}

func (h *Handler) GetLibrary(c *gin.Context) {
	params := repository.LibrarySearchParams{
		Query: c.Query("q"),
		Sort:  c.DefaultQuery("sort", "newest"),
	}
	if genreID := c.Query("genreId"); genreID != "" {
		id, err := uuid.Parse(genreID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid genre id"})
			return
		}
		params.GenreID = &id
	}
	if authorID := c.Query("authorId"); authorID != "" {
		id, err := uuid.Parse(authorID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid author id"})
			return
		}
		params.AuthorID = &id
	}
	books, err := h.library.List(c.Request.Context(), params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load library"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"books": books})
}

func (h *Handler) GetRecommendedLibrary(c *gin.Context) {
	user, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	limit := 8
	if raw := c.Query("limit"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	books, err := h.recommendations.Recommend(c.Request.Context(), user.ID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load recommendations"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"books": books})
}

func (h *Handler) GetDocumentPreview(c *gin.Context) {
	user, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	documentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid document id"})
		return
	}
	preview, err := h.reading.GetPreview(c.Request.Context(), user.ID, documentID)
	if err != nil {
		if errors.Is(err, service.ErrReaderNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load preview"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"preview": preview})
}

func (h *Handler) GetDocumentPage(c *gin.Context) {
	user, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	documentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid document id"})
		return
	}
	page, err := strconv.Atoi(c.Param("page"))
	if err != nil || page < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid page"})
		return
	}
	view, err := h.reading.GetPage(c.Request.Context(), user.ID, documentID, page)
	if err != nil {
		if errors.Is(err, service.ErrReaderForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if errors.Is(err, service.ErrReaderNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
			return
		}
		if errors.Is(err, service.ErrInvalidPage) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid page"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load page"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"page": view})
}

func (h *Handler) SaveProgress(c *gin.Context) {
	user, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	var req service.ProgressUpdate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if err := h.validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	progress, err := h.progress.Save(c.Request.Context(), user.ID, req)
	if err != nil {
		if errors.Is(err, service.ErrReaderForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if errors.Is(err, service.ErrInvalidPage) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid page"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save progress"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"progress": progress})
}

func (h *Handler) GetDocketBooks(c *gin.Context) {
	user, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	books, err := h.reading.ListDocketBooks(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load docket books"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"books": books})
}
