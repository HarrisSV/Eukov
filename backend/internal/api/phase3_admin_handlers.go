package api

import (
	"net/http"

	"github.com/eukov/backend/internal/middleware"
	"github.com/eukov/backend/internal/roles"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (h *Handler) GetDocketWorkspace(c *gin.Context) {
	user, ok := middleware.GetAuthUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	workspace, err := h.docket.GetWorkspace(c.Request.Context(), user.ID, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load docket"})
		return
	}
	c.JSON(http.StatusOK, workspace)
}

func (h *Handler) GetAdminAuthorActivity(c *gin.Context) {
	activity, err := h.adminActivity.ListAuthorActivity(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load author activity"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"authors": activity})
}

func (h *Handler) SuperAdminReviewDraft(c *gin.Context) {
	user, ok := middleware.GetAuthUser(c)
	if !ok || user.Role != roles.SuperAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "super admin required"})
		return
	}

	documentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid document id"})
		return
	}

	doc, err := h.documents.ReviewDraftContent(c.Request.Context(), user.ID, documentID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"document": doc})
}
