package service

import (
	"context"
	"encoding/json"

	"github.com/eukov/backend/internal/models"
	"gorm.io/datatypes"
	"github.com/eukov/backend/internal/repository"
	"github.com/google/uuid"
)

type AuditService struct {
	audit *repository.AuditLogRepository
}

func NewAuditService(audit *repository.AuditLogRepository) *AuditService {
	return &AuditService{audit: audit}
}

func (s *AuditService) Record(ctx context.Context, actorID *uuid.UUID, action, entityType string, entityID *uuid.UUID, metadata map[string]any) error {
	raw, err := json.Marshal(metadata)
	if err != nil {
		return err
	}

	log := &models.AuditLog{
		ActorID:    actorID,
		Action:     action,
		EntityType: entityType,
		EntityID:   entityID,
		Metadata:   datatypes.JSON(raw),
	}
	return s.audit.Create(ctx, log)
}

func (s *AuditService) ListRecent(ctx context.Context, limit int) ([]models.AuditLog, error) {
	if limit <= 0 {
		limit = 50
	}
	return s.audit.ListRecent(ctx, limit)
}
