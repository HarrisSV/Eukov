package service

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/repository"
	"github.com/eukov/backend/internal/roles"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

const (
	InboxTypeAuthorRequestAck = "AUTHOR_REQUEST_ACK"
	InboxTypeAdminReply       = "ADMIN_REPLY"
	InboxTypeAuthorRequest    = "AUTHOR_REQUEST"
	InboxTypeAuthorPromoted   = "AUTHOR_PROMOTED"
	InboxTypeBookRelease      = "BOOK_RELEASE"
)

type InboxService struct {
	inbox *repository.InboxRepository
	users *repository.UserRepository
}

func NewInboxService(inbox *repository.InboxRepository, users *repository.UserRepository) *InboxService {
	return &InboxService{inbox: inbox, users: users}
}

func (s *InboxService) ListForUser(ctx context.Context, userID uuid.UUID, limit int) ([]models.InboxMessage, error) {
	return s.inbox.ListByUser(ctx, userID, limit)
}

func (s *InboxService) MarkRead(ctx context.Context, userID, messageID uuid.UUID) error {
	return s.inbox.MarkRead(ctx, userID, messageID)
}

func (s *InboxService) NotifyUser(ctx context.Context, userID uuid.UUID, senderID *uuid.UUID, messageType, subject, body string, relatedID *uuid.UUID, metadata map[string]any) error {
	raw, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	if metadata == nil {
		raw = []byte("{}")
	}
	return s.inbox.Create(ctx, &models.InboxMessage{
		UserID:      userID,
		SenderID:    senderID,
		MessageType: messageType,
		Subject:     subject,
		Body:        body,
		RelatedID:   relatedID,
		Metadata:    datatypes.JSON(raw),
	})
}

func (s *InboxService) NotifyAdmins(ctx context.Context, senderID uuid.UUID, messageType, subject, body string, relatedID *uuid.UUID) error {
	admins, err := s.users.FindByRoles(ctx, []string{roles.Admin, roles.SuperAdmin})
	if err != nil {
		return err
	}
	for _, admin := range admins {
		if err := s.NotifyUser(ctx, admin.ID, &senderID, messageType, subject, body, relatedID, nil); err != nil {
			return err
		}
	}
	return nil
}

func (s *InboxService) NotifyBookRelease(ctx context.Context, authorID uuid.UUID, documentID uuid.UUID, title, authorLabel string, subscriberIDs []uuid.UUID) error {
	subject := fmt.Sprintf("New release: %s", title)
	body := fmt.Sprintf("%s published a new book: %s. Visit the Library to read it.", authorLabel, title)
	relatedID := documentID
	for _, readerID := range subscriberIDs {
		if readerID == authorID {
			continue
		}
		if err := s.NotifyUser(ctx, readerID, &authorID, InboxTypeBookRelease, subject, body, &relatedID, map[string]any{
			"documentId": documentID.String(),
			"title":      title,
		}); err != nil {
			return err
		}
	}
	return nil
}
