package service

import (
	"context"

	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/repository"
	"github.com/eukov/backend/internal/roles"
	"github.com/google/uuid"
)

type AdminActivityService struct {
	users     *repository.UserRepository
	documents *repository.DocumentRepository
	events    *repository.PublishAuditEventRepository
	unpublish *repository.UnpublishRepository
}

func NewAdminActivityService(
	users *repository.UserRepository,
	documents *repository.DocumentRepository,
	events *repository.PublishAuditEventRepository,
	unpublish *repository.UnpublishRepository,
) *AdminActivityService {
	return &AdminActivityService{
		users:     users,
		documents: documents,
		events:    events,
		unpublish: unpublish,
	}
}

type AuthorActivitySummary struct {
	UserID         uuid.UUID `json:"userId"`
	Email          string    `json:"email"`
	Role           string    `json:"role"`
	DraftCount     int64     `json:"draftCount"`
	PublishedCount int64     `json:"publishedCount"`
	RecentEvents   []PublishEventSummary `json:"recentEvents"`
}

type PublishEventSummary struct {
	ID         string `json:"id"`
	EventType  string `json:"eventType"`
	DocumentID string `json:"documentId,omitempty"`
	CreatedAt  string `json:"createdAt"`
}

func (s *AdminActivityService) ListAuthorActivity(ctx context.Context) ([]AuthorActivitySummary, error) {
	authors, err := s.listAuthors(ctx)
	if err != nil {
		return nil, err
	}

	summaries := make([]AuthorActivitySummary, 0, len(authors))
	for _, author := range authors {
		drafts, _ := s.documents.CountByAuthorAndStatus(ctx, author.ID, DocumentStatusDraft)
		published, _ := s.documents.CountByAuthorAndStatus(ctx, author.ID, DocumentStatusPublished)
		events, _ := s.events.ListByActor(ctx, author.ID, 10)

		recent := make([]PublishEventSummary, 0, len(events))
		for _, ev := range events {
			summary := PublishEventSummary{
				ID:        ev.ID.String(),
				EventType: ev.EventType,
				CreatedAt: ev.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			}
			if ev.DocumentID != nil {
				summary.DocumentID = ev.DocumentID.String()
			}
			recent = append(recent, summary)
		}

		summaries = append(summaries, AuthorActivitySummary{
			UserID:         author.ID,
			Email:          author.Email,
			Role:           author.Role,
			DraftCount:     drafts,
			PublishedCount: published,
			RecentEvents:   recent,
		})
	}
	return summaries, nil
}

func (s *AdminActivityService) listAuthors(ctx context.Context) ([]models.User, error) {
	return s.users.FindByRoles(ctx, []string{roles.Author, roles.Admin, roles.SuperAdmin})
}
