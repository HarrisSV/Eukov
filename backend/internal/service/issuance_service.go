package service

import (
	"context"
	"errors"
	"time"

	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/repository"
	"github.com/google/uuid"
)

var (
	ErrBookNotPublished = errors.New("book is not published")
)

type IssuanceService struct {
	issued    *repository.IssuedBookRepository
	documents *repository.DocumentRepository
	subs      *repository.AuthorSubscriptionRepository
	users     *repository.UserRepository
	activity  *repository.ReaderActivityRepository
	dockets   *repository.DocketItemRepository
	progress  *repository.ReadingProgressRepository
}

func NewIssuanceService(
	issued *repository.IssuedBookRepository,
	documents *repository.DocumentRepository,
	subs *repository.AuthorSubscriptionRepository,
	users *repository.UserRepository,
	activity *repository.ReaderActivityRepository,
	dockets *repository.DocketItemRepository,
	progress *repository.ReadingProgressRepository,
) *IssuanceService {
	return &IssuanceService{
		issued:    issued,
		documents: documents,
		subs:      subs,
		users:     users,
		activity:  activity,
		dockets:   dockets,
		progress:  progress,
	}
}

func (s *IssuanceService) Issue(ctx context.Context, readerID, documentID uuid.UUID) (*models.IssuedBook, error) {
	doc, err := s.documents.FindByID(ctx, documentID)
	if err != nil {
		if err == repository.ErrDocumentNotFound {
			return nil, ErrReaderNotFound
		}
		return nil, err
	}
	if doc.Status != "PUBLISHED" {
		return nil, ErrBookNotPublished
	}
	if existing, err := s.issued.Find(ctx, readerID, documentID); err == nil {
		return existing, nil
	} else if err != repository.ErrIssuedBookNotFound {
		return nil, err
	}

	book := &models.IssuedBook{
		ReaderID:   readerID,
		DocumentID: documentID,
		IssuedAt:   time.Now().UTC(),
	}
	if err := s.issued.Create(ctx, book); err != nil {
		return nil, err
	}
	_ = s.dockets.Upsert(ctx, &models.DocketItem{
		UserID:   readerID,
		ItemType: repository.DocketItemIssuedBook,
		ItemID:   documentID,
	})
	_ = s.activity.Record(ctx, readerID, documentID, repository.ActivityBookIssued)
	_ = s.progress.Upsert(ctx, &models.ReadingProgress{
		ReaderID:             readerID,
		DocumentID:           documentID,
		CurrentPage:          1,
		CompletionPercentage: 0,
	})
	return book, nil
}

func (s *IssuanceService) HasAccess(ctx context.Context, readerID, documentID uuid.UUID) (bool, error) {
	doc, err := s.documents.FindByID(ctx, documentID)
	if err != nil {
		if err == repository.ErrDocumentNotFound {
			return false, nil
		}
		return false, err
	}
	if doc.AuthorID == readerID {
		return true, nil
	}
	if _, err := s.subs.Find(ctx, readerID, doc.AuthorID); err == nil {
		return true, nil
	}
	_, err = s.issued.Find(ctx, readerID, documentID)
	if err == repository.ErrIssuedBookNotFound {
		return false, nil
	}
	return err == nil, err
}

func (s *IssuanceService) HasPreviewAccess(ctx context.Context, documentID uuid.UUID) (bool, error) {
	doc, err := s.documents.FindByID(ctx, documentID)
	if err != nil {
		if err == repository.ErrDocumentNotFound {
			return false, nil
		}
		return false, err
	}
	return doc.Status == "PUBLISHED", nil
}

func (s *IssuanceService) EnsureInDocket(ctx context.Context, readerID, documentID uuid.UUID) error {
	if _, err := s.issued.Find(ctx, readerID, documentID); err == nil {
		return nil
	}
	doc, err := s.documents.FindByID(ctx, documentID)
	if err != nil {
		return err
	}
	if _, err := s.subs.Find(ctx, readerID, doc.AuthorID); err != nil {
		return nil
	}
	_, err = s.Issue(ctx, readerID, documentID)
	return err
}

func (s *IssuanceService) TouchOpened(ctx context.Context, readerID, documentID uuid.UUID) error {
	_ = s.EnsureInDocket(ctx, readerID, documentID)
	if err := s.issued.TouchOpened(ctx, readerID, documentID); err != nil {
		if err == repository.ErrIssuedBookNotFound {
			return s.activity.Record(ctx, readerID, documentID, repository.ActivityBookOpened)
		}
		return err
	}
	return s.activity.Record(ctx, readerID, documentID, repository.ActivityBookOpened)
}

func (s *IssuanceService) ListByReader(ctx context.Context, readerID uuid.UUID) ([]models.IssuedBook, error) {
	return s.issued.ListByReader(ctx, readerID)
}
