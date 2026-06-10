package service

import (
	"context"
	"errors"
	"time"

	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/repository"
	"github.com/eukov/backend/internal/roles"
	"github.com/google/uuid"
)

var ErrApplicationNotPending = errors.New("application is not pending")

type AuthorApplicationService struct {
	apps  *repository.AuthorApplicationRepository
	users *repository.UserRepository
	audit *AuditService
}

func NewAuthorApplicationService(
	apps *repository.AuthorApplicationRepository,
	users *repository.UserRepository,
	audit *AuditService,
) *AuthorApplicationService {
	return &AuthorApplicationService{apps: apps, users: users, audit: audit}
}

type SubmitApplicationInput struct {
	UserID         uuid.UUID
	Qualifications string
	Experience     string
}

func (s *AuthorApplicationService) Submit(ctx context.Context, input SubmitApplicationInput) (*models.AuthorApplication, error) {
	user, err := s.users.FindByID(ctx, input.UserID)
	if err != nil {
		return nil, err
	}
	if user.Role != roles.Reader {
		return nil, errors.New("only readers can apply for author status")
	}

	app := &models.AuthorApplication{
		UserID:         input.UserID,
		Qualifications: input.Qualifications,
		Experience:     input.Experience,
		Status:         "PENDING",
	}
	if err := s.apps.Create(ctx, app); err != nil {
		return nil, err
	}

	actorID := input.UserID
	_ = s.audit.Record(ctx, &actorID, "AUTHOR_APPLICATION_SUBMITTED", "author_application", &app.ID, nil)
	return app, nil
}

func (s *AuthorApplicationService) ListPending(ctx context.Context) ([]models.AuthorApplication, error) {
	return s.apps.ListByStatus(ctx, "PENDING")
}

func (s *AuthorApplicationService) ListByStatus(ctx context.Context, status string) ([]models.AuthorApplication, error) {
	return s.apps.ListByStatus(ctx, status)
}

func (s *AuthorApplicationService) Approve(ctx context.Context, applicationID, reviewerID uuid.UUID) error {
	return s.review(ctx, applicationID, reviewerID, "APPROVED", roles.Author)
}

func (s *AuthorApplicationService) Reject(ctx context.Context, applicationID, reviewerID uuid.UUID) error {
	return s.review(ctx, applicationID, reviewerID, "REJECTED", "")
}

func (s *AuthorApplicationService) review(ctx context.Context, applicationID, reviewerID uuid.UUID, status, promoteRole string) error {
	app, err := s.apps.FindByID(ctx, applicationID)
	if err != nil {
		return err
	}
	if app.Status != "PENDING" {
		return ErrApplicationNotPending
	}

	now := time.Now()
	app.Status = status
	app.ReviewedBy = &reviewerID
	app.ReviewedAt = &now
	app.UpdatedAt = now
	if err := s.apps.Update(ctx, app); err != nil {
		return err
	}

	if promoteRole != "" {
		if err := s.users.UpdateRole(ctx, app.UserID, promoteRole); err != nil {
			return err
		}
	}

	action := "AUTHOR_APPLICATION_REJECTED"
	if status == "APPROVED" {
		action = "AUTHOR_APPLICATION_APPROVED"
	}
	return s.audit.Record(ctx, &reviewerID, action, "author_application", &app.ID, map[string]any{
		"userId": app.UserID,
		"status": status,
	})
}
