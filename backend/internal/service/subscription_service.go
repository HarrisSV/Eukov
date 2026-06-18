package service

import (
	"context"

	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/repository"
	"github.com/eukov/backend/internal/roles"
	"github.com/google/uuid"
)

type SubscriptionService struct {
	subs     *repository.AuthorSubscriptionRepository
	users    *repository.UserRepository
	dockets  *repository.DocketItemRepository
	audit    *AuditService
	issuance *IssuanceService
}

func NewSubscriptionService(
	subs *repository.AuthorSubscriptionRepository,
	users *repository.UserRepository,
	dockets *repository.DocketItemRepository,
	audit *AuditService,
	issuance *IssuanceService,
) *SubscriptionService {
	return &SubscriptionService{subs: subs, users: users, dockets: dockets, audit: audit, issuance: issuance}
}

func (s *SubscriptionService) Subscribe(ctx context.Context, readerID, authorID uuid.UUID, documentID *uuid.UUID) (*models.AuthorSubscription, error) {
	author, err := s.users.FindByID(ctx, authorID)
	if err != nil {
		if err == repository.ErrUserNotFound {
			return nil, ErrReaderNotFound
		}
		return nil, err
	}
	if author.Role != roles.Author && author.Role != roles.SuperAdmin {
		return nil, ErrReaderForbidden
	}
	sub := &models.AuthorSubscription{ReaderID: readerID, AuthorID: authorID}
	if err := s.subs.Create(ctx, sub); err != nil {
		if err != repository.ErrAuthorSubscriptionExists {
			return nil, err
		}
		if existing, findErr := s.subs.Find(ctx, readerID, authorID); findErr == nil {
			sub = existing
		}
	} else {
		_ = s.dockets.Upsert(ctx, &models.DocketItem{
			UserID:   readerID,
			ItemType: repository.DocketItemAuthorSub,
			ItemID:   authorID,
		})
		_ = s.audit.Record(ctx, &readerID, "AUTHOR_SUBSCRIBED", "author", &authorID, nil)
	}
	if documentID != nil && s.issuance != nil {
		if _, err := s.issuance.Issue(ctx, readerID, *documentID); err != nil && err != ErrBookNotPublished {
			return sub, err
		}
	}
	return sub, nil
}

func (s *SubscriptionService) Unsubscribe(ctx context.Context, readerID, authorID uuid.UUID) error {
	if err := s.subs.Delete(ctx, readerID, authorID); err != nil {
		return err
	}
	return s.dockets.DeleteByRef(ctx, readerID, repository.DocketItemAuthorSub, authorID)
}

func (s *SubscriptionService) IsSubscribed(ctx context.Context, readerID, authorID uuid.UUID) (bool, error) {
	_, err := s.subs.Find(ctx, readerID, authorID)
	if err == repository.ErrAuthorSubscriptionNotFound {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *SubscriptionService) ListReadersByAuthor(ctx context.Context, authorID uuid.UUID) ([]uuid.UUID, error) {
	return s.subs.ListReadersByAuthor(ctx, authorID)
}
