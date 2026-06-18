package repository

import (
	"context"
	"errors"

	"github.com/eukov/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var ErrAttachmentNotFound = errors.New("attachment not found")

type ApplicationAttachmentRepository struct {
	db *gorm.DB
}

func NewApplicationAttachmentRepository(db *gorm.DB) *ApplicationAttachmentRepository {
	return &ApplicationAttachmentRepository{db: db}
}

func (r *ApplicationAttachmentRepository) Create(ctx context.Context, attachment *models.AuthorApplicationAttachment) error {
	if attachment.ID == uuid.Nil {
		attachment.ID = uuid.New()
	}
	return r.db.WithContext(ctx).Create(attachment).Error
}

func (r *ApplicationAttachmentRepository) ListByApplication(ctx context.Context, applicationID uuid.UUID) ([]models.AuthorApplicationAttachment, error) {
	var attachments []models.AuthorApplicationAttachment
	err := r.db.WithContext(ctx).
		Where("application_id = ?", applicationID).
		Order("created_at ASC").
		Find(&attachments).Error
	return attachments, err
}

func (r *ApplicationAttachmentRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.AuthorApplicationAttachment, error) {
	var attachment models.AuthorApplicationAttachment
	result := r.db.WithContext(ctx).Where("id = ?", id).First(&attachment)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrAttachmentNotFound
		}
		return nil, result.Error
	}
	return &attachment, nil
}

type InboxRepository struct {
	db *gorm.DB
}

func NewInboxRepository(db *gorm.DB) *InboxRepository {
	return &InboxRepository{db: db}
}

func (r *InboxRepository) Create(ctx context.Context, message *models.InboxMessage) error {
	if message.ID == uuid.Nil {
		message.ID = uuid.New()
	}
	return r.db.WithContext(ctx).Create(message).Error
}

func (r *InboxRepository) ListByUser(ctx context.Context, userID uuid.UUID, limit int) ([]models.InboxMessage, error) {
	if limit <= 0 {
		limit = 50
	}
	var messages []models.InboxMessage
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Find(&messages).Error
	return messages, err
}

func (r *InboxRepository) MarkRead(ctx context.Context, userID, messageID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&models.InboxMessage{}).
		Where("id = ? AND user_id = ?", messageID, userID).
		Update("read_at", gorm.Expr("NOW()")).Error
}

func (r *AuthorApplicationRepository) FindLatestByUser(ctx context.Context, userID uuid.UUID) (*models.AuthorApplication, error) {
	var app models.AuthorApplication
	result := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		First(&app)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrApplicationNotFound
		}
		return nil, result.Error
	}
	return &app, nil
}
