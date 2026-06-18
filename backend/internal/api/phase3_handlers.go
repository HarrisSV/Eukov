package api

import (
	"errors"
	"net/http"

	"github.com/eukov/backend/internal/middleware"
	"github.com/eukov/backend/internal/repository"
	"github.com/eukov/backend/internal/roles"
	"github.com/eukov/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (h *Handler) CreateDocument(c *gin.Context) {
	user, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req struct {
		Title   string `json:"title" validate:"required,min=1,max=255"`
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if err := h.validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	doc, err := h.documents.CreateDraft(c.Request.Context(), user.ID, service.CreateDocumentInput{
		Title:   req.Title,
		Content: req.Content,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create document"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"document": doc})
}

func (h *Handler) UpdateDocument(c *gin.Context) {
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

	var req struct {
		Title   string `json:"title" validate:"required,min=1,max=255"`
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if err := h.validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	doc, err := h.documents.UpdateDraft(c.Request.Context(), user.ID, documentID, service.UpdateDocumentInput{
		Title:   req.Title,
		Content: req.Content,
	})
	if err != nil {
		if errors.Is(err, service.ErrDocumentForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if errors.Is(err, service.ErrDocumentNotDraft) {
			c.JSON(http.StatusConflict, gin.H{"error": "only drafts can be edited"})
			return
		}
		if errors.Is(err, repository.ErrDocumentNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update document"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"document": doc})
}

func (h *Handler) DeleteDocument(c *gin.Context) {
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

	if err := h.documents.DeleteDraft(c.Request.Context(), user.ID, documentID); err != nil {
		if errors.Is(err, service.ErrDocumentForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if errors.Is(err, service.ErrDocumentNotDraft) {
			c.JSON(http.StatusConflict, gin.H{"error": "only drafts can be deleted"})
			return
		}
		if errors.Is(err, repository.ErrDocumentNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete document"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) PublishDocument(c *gin.Context) {
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

	var req struct {
		Genre   string   `json:"genre" validate:"required"`
		Tags    []string `json:"tags" validate:"required,min=1,dive,required"`
		Title   string   `json:"title"`
		Content string   `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if err := h.validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	doc, err := h.documents.Publish(c.Request.Context(), user.ID, documentID, service.PublishDocumentInput{
		Genre:   req.Genre,
		Tags:    req.Tags,
		Title:   req.Title,
		Content: req.Content,
	})
	if err != nil {
		if errors.Is(err, service.ErrPublishValidation) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, service.ErrDocumentForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if errors.Is(err, service.ErrDocumentNotDraft) {
			c.JSON(http.StatusConflict, gin.H{"error": "only drafts can be published"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to publish document"})
		return
	}
	h.notifyBookRelease(c, user.ID, documentID, doc.Title)
	c.JSON(http.StatusOK, gin.H{"document": doc})
}

func (h *Handler) ListDocuments(c *gin.Context) {
	user, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	mine := c.Query("mine") == "true"
	if roles.HasAtLeast(user.Role, roles.Author) && mine {
		docs, err := h.documents.ListDocuments(c.Request.Context(), user.ID, user.Role, true)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list documents"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"documents": docs})
		return
	}

	docs, err := h.documents.ListDocuments(c.Request.Context(), user.ID, user.Role, false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list documents"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"documents": docs})
}

func (h *Handler) GetDocument(c *gin.Context) {
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

	doc, err := h.documents.GetDocument(c.Request.Context(), user.ID, user.Role, documentID)
	if err != nil {
		if errors.Is(err, service.ErrDocumentForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		if errors.Is(err, repository.ErrDocumentNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch document"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"document": doc})
}

func (h *Handler) SubmitUnpublishRequest(c *gin.Context) {
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

	var req struct {
		Justification string `json:"justification" validate:"required,min=10"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if err := h.validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.documents.SubmitUnpublishRequest(c.Request.Context(), user.ID, documentID, req.Justification); err != nil {
		if errors.Is(err, repository.ErrUnpublishExists) {
			c.JSON(http.StatusConflict, gin.H{"error": "pending unpublish request already exists"})
			return
		}
		if errors.Is(err, service.ErrDocumentNotPublished) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "only published documents can be unpublished"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true})
}

func (h *Handler) ListUnpublishRequests(c *gin.Context) {
	status := c.DefaultQuery("status", "PENDING")
	reqs, err := h.documents.ListUnpublishRequests(c.Request.Context(), status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list requests"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"requests": reqs})
}

func (h *Handler) ApproveUnpublishRequest(c *gin.Context) {
	h.reviewUnpublishRequest(c, true)
}

func (h *Handler) RejectUnpublishRequest(c *gin.Context) {
	h.reviewUnpublishRequest(c, false)
}

func (h *Handler) reviewUnpublishRequest(c *gin.Context, approve bool) {
	user, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	requestID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request id"})
		return
	}

	var reviewErr error
	if approve {
		reviewErr = h.documents.ApproveUnpublish(c.Request.Context(), user.ID, requestID)
	} else {
		reviewErr = h.documents.RejectUnpublish(c.Request.Context(), user.ID, requestID)
	}
	if reviewErr != nil {
		if errors.Is(reviewErr, repository.ErrUnpublishNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "request not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": reviewErr.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
