package repository

import (
	"context"
	"errors"
	"time"

	"github.com/eukov/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrDocumentNotFound     = errors.New("document not found")
	ErrDocketNotFound       = errors.New("docket not found")
	ErrUnpublishNotFound    = errors.New("unpublish request not found")
	ErrUnpublishExists      = errors.New("pending unpublish request already exists")
)

type DocketRepository struct {
	db *gorm.DB
}

func NewDocketRepository(db *gorm.DB) *DocketRepository {
	return &DocketRepository{db: db}
}

func (r *DocketRepository) FindOrCreateForUser(ctx context.Context, userID uuid.UUID) (*models.Docket, error) {
	var docket models.Docket
	result := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&docket)
	if result.Error == nil {
		return &docket, nil
	}
	if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, result.Error
	}

	docket = models.Docket{
		ID:     uuid.New(),
		UserID: userID,
		Name:   "Workspace",
	}
	if err := r.db.WithContext(ctx).Create(&docket).Error; err != nil {
		return nil, err
	}
	return &docket, nil
}

func (r *DocketRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.Docket, error) {
	var docket models.Docket
	result := r.db.WithContext(ctx).Where("id = ?", id).First(&docket)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrDocketNotFound
		}
		return nil, result.Error
	}
	return &docket, nil
}

type DocumentRepository struct {
	db *gorm.DB
}

func NewDocumentRepository(db *gorm.DB) *DocumentRepository {
	return &DocumentRepository{db: db}
}

func (r *DocumentRepository) Create(ctx context.Context, doc *models.Document) error {
	if doc.ID == uuid.Nil {
		doc.ID = uuid.New()
	}
	return r.db.WithContext(ctx).Create(doc).Error
}

func (r *DocumentRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.Document, error) {
	var doc models.Document
	result := r.db.WithContext(ctx).Where("id = ?", id).First(&doc)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrDocumentNotFound
		}
		return nil, result.Error
	}
	return &doc, nil
}

func (r *DocumentRepository) Update(ctx context.Context, doc *models.Document) error {
	doc.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Save(doc).Error
}

func (r *DocumentRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&models.Document{}).Error
}

func (r *DocumentRepository) ListByAuthor(ctx context.Context, authorID uuid.UUID) ([]models.Document, error) {
	var docs []models.Document
	err := r.db.WithContext(ctx).
		Where("author_id = ?", authorID).
		Order("updated_at DESC").
		Find(&docs).Error
	return docs, err
}

func (r *DocumentRepository) CountByAuthorAndStatus(ctx context.Context, authorID uuid.UUID, status string) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&models.Document{}).
		Where("author_id = ? AND status = ?", authorID, status).
		Count(&count).Error
	return count, err
}

func (r *DocumentRepository) ListPublished(ctx context.Context) ([]models.Document, error) {
	var docs []models.Document
	err := r.db.WithContext(ctx).
		Where("status = ?", "PUBLISHED").
		Order("updated_at DESC").
		Find(&docs).Error
	return docs, err
}

func (r *DocumentRepository) AuthorIDForDocument(ctx context.Context, documentID uuid.UUID) (uuid.UUID, error) {
	doc, err := r.FindByID(ctx, documentID)
	if err != nil {
		return uuid.Nil, err
	}
	if doc.AuthorID != uuid.Nil {
		return doc.AuthorID, nil
	}
	var userIDStr string
	err = r.db.WithContext(ctx).
		Table("documents").
		Select("dockets.user_id").
		Joins("JOIN dockets ON dockets.id = documents.docket_id").
		Where("documents.id = ?", documentID).
		Scan(&userIDStr).Error
	if err != nil {
		return uuid.Nil, err
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil || userID == uuid.Nil {
		return uuid.Nil, ErrDocumentNotFound
	}
	return userID, nil
}

type DocumentTagRepository struct {
	db *gorm.DB
}

func NewDocumentTagRepository(db *gorm.DB) *DocumentTagRepository {
	return &DocumentTagRepository{db: db}
}

func (r *DocumentTagRepository) ReplaceTags(ctx context.Context, documentID uuid.UUID, tags []string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("document_id = ?", documentID).Delete(&models.DocumentTag{}).Error; err != nil {
			return err
		}
		for _, tag := range tags {
			record := models.DocumentTag{
				ID:         uuid.New(),
				DocumentID: documentID,
				Tag:        tag,
			}
			if err := tx.Create(&record).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *DocumentTagRepository) ListByDocument(ctx context.Context, documentID uuid.UUID) ([]string, error) {
	var tags []string
	err := r.db.WithContext(ctx).
		Model(&models.DocumentTag{}).
		Where("document_id = ?", documentID).
		Order("tag ASC").
		Pluck("tag", &tags).Error
	return tags, err
}

type UnpublishRepository struct {
	db *gorm.DB
}

func NewUnpublishRepository(db *gorm.DB) *UnpublishRepository {
	return &UnpublishRepository{db: db}
}

func (r *UnpublishRepository) Create(ctx context.Context, req *models.UnpublishRequest) error {
	if req.ID == uuid.Nil {
		req.ID = uuid.New()
	}
	var count int64
	if err := r.db.WithContext(ctx).
		Model(&models.UnpublishRequest{}).
		Where("document_id = ? AND status = ?", req.DocumentID, "PENDING").
		Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return ErrUnpublishExists
	}
	return r.db.WithContext(ctx).Create(req).Error
}

func (r *UnpublishRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.UnpublishRequest, error) {
	var req models.UnpublishRequest
	result := r.db.WithContext(ctx).Where("id = ?", id).First(&req)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrUnpublishNotFound
		}
		return nil, result.Error
	}
	return &req, nil
}

func (r *UnpublishRepository) ListByStatus(ctx context.Context, status string) ([]models.UnpublishRequest, error) {
	var reqs []models.UnpublishRequest
	err := r.db.WithContext(ctx).
		Where("status = ?", status).
		Order("created_at ASC").
		Find(&reqs).Error
	return reqs, err
}

func (r *UnpublishRepository) Update(ctx context.Context, req *models.UnpublishRequest) error {
	req.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Save(req).Error
}

type DocumentMetadataRepository struct {
	db *gorm.DB
}

func NewDocumentMetadataRepository(db *gorm.DB) *DocumentMetadataRepository {
	return &DocumentMetadataRepository{db: db}
}

func (r *DocumentMetadataRepository) Upsert(ctx context.Context, meta *models.DocumentMetadata) error {
	if meta.ID == uuid.Nil {
		meta.ID = uuid.New()
	}
	var existing models.DocumentMetadata
	err := r.db.WithContext(ctx).Where("document_id = ?", meta.DocumentID).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return r.db.WithContext(ctx).Create(meta).Error
	}
	if err != nil {
		return err
	}
	existing.GenreID = meta.GenreID
	existing.Summary = meta.Summary
	existing.ReadingTime = meta.ReadingTime
	return r.db.WithContext(ctx).Save(&existing).Error
}

type DocketItemRepository struct {
	db *gorm.DB
}

func NewDocketItemRepository(db *gorm.DB) *DocketItemRepository {
	return &DocketItemRepository{db: db}
}

const (
	DocketItemManuscript     = "MANUSCRIPT"
	DocketItemLibrarySub     = "LIBRARY_SUBSCRIPTION"
	DocketItemSavedBook      = "SAVED_BOOK"
)

func (r *DocketItemRepository) Upsert(ctx context.Context, item *models.DocketItem) error {
	if item.ID == uuid.Nil {
		item.ID = uuid.New()
	}
	var existing models.DocketItem
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND item_type = ? AND item_id = ?", item.UserID, item.ItemType, item.ItemID).
		First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return r.db.WithContext(ctx).Create(item).Error
	}
	if err != nil {
		return err
	}
	existing.SavedAt = time.Now()
	return r.db.WithContext(ctx).Save(&existing).Error
}

func (r *DocketItemRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]models.DocketItem, error) {
	var items []models.DocketItem
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("saved_at DESC").
		Find(&items).Error
	return items, err
}

func (r *DocketItemRepository) ListByUserAndType(ctx context.Context, userID uuid.UUID, itemType string) ([]models.DocketItem, error) {
	var items []models.DocketItem
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND item_type = ?", userID, itemType).
		Order("saved_at DESC").
		Find(&items).Error
	return items, err
}

type PublishAuditEventRepository struct {
	db *gorm.DB
}

func NewPublishAuditEventRepository(db *gorm.DB) *PublishAuditEventRepository {
	return &PublishAuditEventRepository{db: db}
}

func (r *PublishAuditEventRepository) Create(ctx context.Context, event *models.PublishAuditEvent) error {
	if event.ID == uuid.Nil {
		event.ID = uuid.New()
	}
	return r.db.WithContext(ctx).Create(event).Error
}

func (r *PublishAuditEventRepository) ListRecent(ctx context.Context, limit int) ([]models.PublishAuditEvent, error) {
	var events []models.PublishAuditEvent
	err := r.db.WithContext(ctx).
		Order("created_at DESC").
		Limit(limit).
		Find(&events).Error
	return events, err
}

func (r *PublishAuditEventRepository) ListByActor(ctx context.Context, actorID uuid.UUID, limit int) ([]models.PublishAuditEvent, error) {
	var events []models.PublishAuditEvent
	err := r.db.WithContext(ctx).
		Where("actor_id = ?", actorID).
		Order("created_at DESC").
		Limit(limit).
		Find(&events).Error
	return events, err
}

// Backward-compatible alias for existing wiring during refactor.
type AuditEventRepository = PublishAuditEventRepository

func NewAuditEventRepository(db *gorm.DB) *PublishAuditEventRepository {
	return NewPublishAuditEventRepository(db)
}
