package api

import (
	"errors"
	"mime/multipart"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/eukov/backend/internal/middleware"
	"github.com/eukov/backend/internal/repository"
	"github.com/eukov/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (h *Handler) ListInbox(c *gin.Context) {
	user, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	limit := 50
	if raw := c.Query("limit"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	messages, err := h.inbox.ListForUser(c.Request.Context(), user.ID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load inbox"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"messages": messages})
}

func (h *Handler) MarkInboxRead(c *gin.Context) {
	user, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	messageID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid message id"})
		return
	}

	if err := h.inbox.MarkRead(c.Request.Context(), user.ID, messageID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark message read"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) GetMyAuthorApplication(c *gin.Context) {
	user, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	app, err := h.authorApps.GetMine(c.Request.Context(), user.ID)
	if err != nil {
		if errors.Is(err, repository.ErrApplicationNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "no author request found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load author request"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"application": app})
}

func (h *Handler) SubmitAuthorApplicationMultipart(c *gin.Context) {
	user, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	subject := c.PostForm("subject")
	message := c.PostForm("message")
	if message == "" {
		message = c.PostForm("body")
	}

	var files []*multipart.FileHeader
	form, err := c.MultipartForm()
	if err == nil && form != nil {
		files = form.File["attachments"]
	}

	app, err := h.authorApps.SubmitRequest(c.Request.Context(), service.SubmitAuthorRequestInput{
		UserID:   user.ID,
		Subject:  subject,
		Message:  message,
		Files:    files,
		BasePath: h.storage.BasePath(),
	})
	if err != nil {
		if errors.Is(err, repository.ErrApplicationExists) {
			c.JSON(http.StatusConflict, gin.H{"error": "pending application already exists"})
			return
		}
		if errors.Is(err, service.ErrValidation) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":          app.ID.String(),
		"status":      app.Status,
		"application": app,
	})
}

type replyAuthorApplicationRequest struct {
	Message          string `json:"message" validate:"required,min=3"`
	IncludeAccessKey bool   `json:"includeAccessKey"`
}

func (h *Handler) ReplyAuthorApplication(c *gin.Context) {
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

	var req replyAuthorApplicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if err := h.validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	app, err := h.authorApps.Reply(c.Request.Context(), service.ReplyAuthorRequestInput{
		ApplicationID:    applicationID,
		ReviewerID:       reviewer.ID,
		ReplyMessage:     req.Message,
		IncludeAccessKey: req.IncludeAccessKey,
	})
	if err != nil {
		if errors.Is(err, service.ErrApplicationNotPending) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, service.ErrValidation) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reply"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"application": app})
}

func (h *Handler) DownloadAuthorApplicationAttachment(c *gin.Context) {
	user, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	attachmentID, err := uuid.Parse(c.Param("attachmentId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid attachment id"})
		return
	}

	attachment, err := h.authorApps.GetAttachment(c.Request.Context(), user.ID, user.Role, attachmentID)
	if err != nil {
		if errors.Is(err, repository.ErrAttachmentNotFound) || errors.Is(err, repository.ErrApplicationNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "attachment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load attachment"})
		return
	}

	if _, err := os.Stat(attachment.StoredPath); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "attachment file missing"})
		return
	}
	c.FileAttachment(attachment.StoredPath, attachment.FileName)
}

func (h *Handler) notifyBookRelease(c *gin.Context, authorID uuid.UUID, documentID uuid.UUID, title string) {
	if h.inbox == nil || h.subscriptions == nil {
		return
	}
	author, err := h.users.FindByID(c.Request.Context(), authorID)
	if err != nil {
		return
	}
	label := author.Nickname
	if label == "" {
		label = strings.TrimSpace(strings.Join([]string{author.FirstName, author.LastName}, " "))
	}
	if label == "" {
		label = author.Email
	}
	readerIDs, err := h.subscriptions.ListReadersByAuthor(c.Request.Context(), authorID)
	if err != nil {
		return
	}
	_ = h.inbox.NotifyBookRelease(c.Request.Context(), authorID, documentID, title, label, readerIDs)
}
