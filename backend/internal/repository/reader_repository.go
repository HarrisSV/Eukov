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
	ErrAuthorSubscriptionNotFound = errors.New("author subscription not found")
	ErrAuthorSubscriptionExists   = errors.New("author subscription already exists")
	ErrIssuedBookNotFound         = errors.New("issued book not found")
	ErrIssuedBookExists           = errors.New("book already issued")
)

type AuthorSubscriptionRepository struct {
	db *gorm.DB
}

func NewAuthorSubscriptionRepository(db *gorm.DB) *AuthorSubscriptionRepository {
	return &AuthorSubscriptionRepository{db: db}
}

func (r *AuthorSubscriptionRepository) Create(ctx context.Context, sub *models.AuthorSubscription) error {
	if sub.ID == uuid.Nil {
		sub.ID = uuid.New()
	}
	var count int64
	if err := r.db.WithContext(ctx).
		Model(&models.AuthorSubscription{}).
		Where("reader_id = ? AND author_id = ?", sub.ReaderID, sub.AuthorID).
		Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return ErrAuthorSubscriptionExists
	}
	return r.db.WithContext(ctx).Create(sub).Error
}

func (r *AuthorSubscriptionRepository) Find(ctx context.Context, readerID, authorID uuid.UUID) (*models.AuthorSubscription, error) {
	var sub models.AuthorSubscription
	result := r.db.WithContext(ctx).
		Where("reader_id = ? AND author_id = ?", readerID, authorID).
		First(&sub)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrAuthorSubscriptionNotFound
		}
		return nil, result.Error
	}
	return &sub, nil
}

func (r *AuthorSubscriptionRepository) Delete(ctx context.Context, readerID, authorID uuid.UUID) error {
	result := r.db.WithContext(ctx).
		Where("reader_id = ? AND author_id = ?", readerID, authorID).
		Delete(&models.AuthorSubscription{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrAuthorSubscriptionNotFound
	}
	return nil
}

func (r *AuthorSubscriptionRepository) ListByReader(ctx context.Context, readerID uuid.UUID) ([]models.AuthorSubscription, error) {
	var subs []models.AuthorSubscription
	err := r.db.WithContext(ctx).
		Where("reader_id = ?", readerID).
		Order("created_at DESC").
		Find(&subs).Error
	return subs, err
}

func (r *AuthorSubscriptionRepository) ListReadersByAuthor(ctx context.Context, authorID uuid.UUID) ([]uuid.UUID, error) {
	var readerIDs []uuid.UUID
	err := r.db.WithContext(ctx).
		Model(&models.AuthorSubscription{}).
		Where("author_id = ?", authorID).
		Pluck("reader_id", &readerIDs).Error
	return readerIDs, err
}

type IssuedBookRepository struct {
	db *gorm.DB
}

func NewIssuedBookRepository(db *gorm.DB) *IssuedBookRepository {
	return &IssuedBookRepository{db: db}
}

func (r *IssuedBookRepository) Create(ctx context.Context, book *models.IssuedBook) error {
	if book.ID == uuid.Nil {
		book.ID = uuid.New()
	}
	var count int64
	if err := r.db.WithContext(ctx).
		Model(&models.IssuedBook{}).
		Where("reader_id = ? AND document_id = ?", book.ReaderID, book.DocumentID).
		Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return ErrIssuedBookExists
	}
	return r.db.WithContext(ctx).Create(book).Error
}

func (r *IssuedBookRepository) Find(ctx context.Context, readerID, documentID uuid.UUID) (*models.IssuedBook, error) {
	var book models.IssuedBook
	result := r.db.WithContext(ctx).
		Where("reader_id = ? AND document_id = ?", readerID, documentID).
		First(&book)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrIssuedBookNotFound
		}
		return nil, result.Error
	}
	return &book, nil
}

func (r *IssuedBookRepository) ListByReader(ctx context.Context, readerID uuid.UUID) ([]models.IssuedBook, error) {
	var books []models.IssuedBook
	err := r.db.WithContext(ctx).
		Where("reader_id = ?", readerID).
		Order("COALESCE(last_opened_at, issued_at) DESC").
		Find(&books).Error
	return books, err
}

func (r *IssuedBookRepository) TouchOpened(ctx context.Context, readerID, documentID uuid.UUID) error {
	now := time.Now()
	result := r.db.WithContext(ctx).
		Model(&models.IssuedBook{}).
		Where("reader_id = ? AND document_id = ?", readerID, documentID).
		Update("last_opened_at", now)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrIssuedBookNotFound
	}
	return nil
}

type ReadingProgressRepository struct {
	db *gorm.DB
}

func NewReadingProgressRepository(db *gorm.DB) *ReadingProgressRepository {
	return &ReadingProgressRepository{db: db}
}

func (r *ReadingProgressRepository) Upsert(ctx context.Context, progress *models.ReadingProgress) error {
	if progress.ID == uuid.Nil {
		progress.ID = uuid.New()
	}
	progress.LastReadAt = time.Now()

	var existing models.ReadingProgress
	err := r.db.WithContext(ctx).
		Where("reader_id = ? AND document_id = ?", progress.ReaderID, progress.DocumentID).
		First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return r.db.WithContext(ctx).Create(progress).Error
	}
	if err != nil {
		return err
	}
	existing.CurrentPage = progress.CurrentPage
	existing.CompletionPercentage = progress.CompletionPercentage
	existing.LastReadAt = progress.LastReadAt
	return r.db.WithContext(ctx).Save(&existing).Error
}

func (r *ReadingProgressRepository) Find(ctx context.Context, readerID, documentID uuid.UUID) (*models.ReadingProgress, error) {
	var progress models.ReadingProgress
	result := r.db.WithContext(ctx).
		Where("reader_id = ? AND document_id = ?", readerID, documentID).
		First(&progress)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, result.Error
	}
	return &progress, nil
}

func (r *ReadingProgressRepository) ListByReader(ctx context.Context, readerID uuid.UUID) ([]models.ReadingProgress, error) {
	var items []models.ReadingProgress
	err := r.db.WithContext(ctx).
		Where("reader_id = ?", readerID).
		Order("last_read_at DESC").
		Find(&items).Error
	return items, err
}

type ReaderActivityRepository struct {
	db *gorm.DB
}

func NewReaderActivityRepository(db *gorm.DB) *ReaderActivityRepository {
	return &ReaderActivityRepository{db: db}
}

const (
	ActivityBookOpened    = "BOOK_OPENED"
	ActivityBookIssued    = "BOOK_ISSUED"
	ActivityBookCompleted = "BOOK_COMPLETED"
	ActivityTTSStarted    = "TTS_STARTED"
	ActivityTTSStopped    = "TTS_STOPPED"
)

func (r *ReaderActivityRepository) Record(ctx context.Context, readerID, documentID uuid.UUID, activityType string) error {
	return r.db.WithContext(ctx).Create(&models.ReaderActivity{
		ID:           uuid.New(),
		ReaderID:     readerID,
		DocumentID:   documentID,
		ActivityType: activityType,
	}).Error
}

func (r *ReaderActivityRepository) ListByReader(ctx context.Context, readerID uuid.UUID, limit int) ([]models.ReaderActivity, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.ReaderActivity
	err := r.db.WithContext(ctx).
		Where("reader_id = ?", readerID).
		Order("created_at DESC").
		Limit(limit).
		Find(&items).Error
	return items, err
}

func (r *ReaderActivityRepository) CountOpensByDocument(ctx context.Context, documentID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&models.ReaderActivity{}).
		Where("document_id = ? AND activity_type = ?", documentID, ActivityBookOpened).
		Count(&count).Error
	return count, err
}
