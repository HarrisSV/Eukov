package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type proofreadRequest struct {
	Text string `json:"text" validate:"required"`
}

func (h *Handler) ProofreadText(c *gin.Context) {
	var req proofreadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if err := h.validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.ai.Proofread(c.Request.Context(), req.Text)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ai proofread failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"result": result})
}

func (h *Handler) GetDocumentAISummary(c *gin.Context) {
	documentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid document id"})
		return
	}

	result, err := h.ai.SummarizeBook(c.Request.Context(), documentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate summary"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"summary": result})
}

func (h *Handler) GetDocumentAIFullSummary(c *gin.Context) {
	documentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid document id"})
		return
	}

	result, err := h.ai.SummarizeFullBook(c.Request.Context(), documentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate full summary"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"summary": result})
}
