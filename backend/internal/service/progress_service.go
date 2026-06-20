package service

import (
	"context"

	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/repository"
	"github.com/google/uuid"
)

type ProgressService struct {
	progress  *repository.ReadingProgressRepository
	issuance  *IssuanceService
	activity  *repository.ReaderActivityRepository
	files     *DocumentFileService
	documents *repository.DocumentRepository
}

func NewProgressService(
	progress *repository.ReadingProgressRepository,
	issuance *IssuanceService,
	activity *repository.ReaderActivityRepository,
	files *DocumentFileService,
	documents *repository.DocumentRepository,
) *ProgressService {
	return &ProgressService{
		progress:  progress,
		issuance:  issuance,
		activity:  activity,
		files:     files,
		documents: documents,
	}
}

type ProgressUpdate struct {
	DocumentID uuid.UUID `json:"documentId" validate:"required"`
	Page       int       `json:"page" validate:"required,min=1"`
}

func (s *ProgressService) Save(ctx context.Context, readerID uuid.UUID, update ProgressUpdate) (*models.ReadingProgress, error) {
	if update.Page < 1 {
		return nil, ErrInvalidPage
	}
	ok, err := s.issuance.HasAccess(ctx, readerID, update.DocumentID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrReaderForbidden
	}
	doc, err := s.documents.FindByID(ctx, update.DocumentID)
	if err != nil {
		return nil, err
	}
	content, err := s.files.ReadContent(doc.AuthorID, update.DocumentID)
	if err != nil {
		return nil, err
	}
	total := TotalReadingPages(content)
	pct := CompletionPercentage(update.Page, total)
	rec := &models.ReadingProgress{
		ReaderID:             readerID,
		DocumentID:           update.DocumentID,
		CurrentPage:          update.Page,
		CompletionPercentage: pct,
	}
	if err := s.progress.Upsert(ctx, rec); err != nil {
		return nil, err
	}
	if update.Page >= total && total > 0 {
		_ = s.activity.Record(ctx, readerID, update.DocumentID, repository.ActivityBookCompleted)
	}
	return rec, nil
}

func (s *ProgressService) Get(ctx context.Context, readerID, documentID uuid.UUID) (*models.ReadingProgress, error) {
	return s.progress.Find(ctx, readerID, documentID)
}
