package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/repository"
	"github.com/eukov/backend/internal/roles"
	"github.com/google/uuid"
)

var ErrApplicationNotPending = errors.New("application is not pending")

type AuthorApplicationService struct {
	apps        *repository.AuthorApplicationRepository
	attachments *repository.ApplicationAttachmentRepository
	users       *repository.UserRepository
	audit       *AuditService
	inbox       *InboxService
	accessKeys  *AccessKeyService
}

func NewAuthorApplicationService(
	apps *repository.AuthorApplicationRepository,
	attachments *repository.ApplicationAttachmentRepository,
	users *repository.UserRepository,
	audit *AuditService,
	inbox *InboxService,
	accessKeys *AccessKeyService,
) *AuthorApplicationService {
	return &AuthorApplicationService{
		apps:        apps,
		attachments: attachments,
		users:       users,
		audit:       audit,
		inbox:       inbox,
		accessKeys:  accessKeys,
	}
}

type SubmitApplicationInput struct {
	UserID         uuid.UUID
	Qualifications string
	Experience     string
}

type AuthorApplicationView struct {
	models.AuthorApplication
	UserEmail    string                               `json:"userEmail"`
	UserNickname string                               `json:"userNickname,omitempty"`
	UserFullName string                               `json:"userFullName,omitempty"`
	Attachments  []models.AuthorApplicationAttachment `json:"attachments"`
}

type SubmitAuthorRequestInput struct {
	UserID   uuid.UUID
	Subject  string
	Message  string
	Files    []*multipart.FileHeader
	BasePath string
}

type ReplyAuthorRequestInput struct {
	ApplicationID    uuid.UUID
	ReviewerID       uuid.UUID
	ReplyMessage     string
	IncludeAccessKey bool
}

func formatUserFullName(user *models.User) string {
	return strings.TrimSpace(strings.Join([]string{user.FirstName, user.MiddleName, user.LastName}, " "))
}

func (s *AuthorApplicationService) Submit(ctx context.Context, input SubmitApplicationInput) (*models.AuthorApplication, error) {
	return s.submitLegacy(ctx, input)
}

func (s *AuthorApplicationService) submitLegacy(ctx context.Context, input SubmitApplicationInput) (*models.AuthorApplication, error) {
	user, err := s.users.FindByID(ctx, input.UserID)
	if err != nil {
		return nil, err
	}
	if user.Role != roles.Reader {
		return nil, errors.New("only readers can apply for author status")
	}

	app := &models.AuthorApplication{
		UserID:         input.UserID,
		Subject:        "Author application",
		MessageBody:    input.Experience,
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

func (s *AuthorApplicationService) enrichApplication(ctx context.Context, app models.AuthorApplication) (AuthorApplicationView, error) {
	view := AuthorApplicationView{AuthorApplication: app}
	user, err := s.users.FindByID(ctx, app.UserID)
	if err == nil {
		view.UserEmail = user.Email
		view.UserNickname = user.Nickname
		view.UserFullName = formatUserFullName(user)
	}
	attachments, err := s.attachments.ListByApplication(ctx, app.ID)
	if err != nil {
		return view, err
	}
	view.Attachments = attachments
	return view, nil
}

func (s *AuthorApplicationService) SubmitRequest(ctx context.Context, input SubmitAuthorRequestInput) (*AuthorApplicationView, error) {
	user, err := s.users.FindByID(ctx, input.UserID)
	if err != nil {
		return nil, err
	}
	if user.Role != roles.Reader {
		return nil, fmt.Errorf("only readers can request author status")
	}

	subject := strings.TrimSpace(input.Subject)
	message := strings.TrimSpace(input.Message)
	if subject == "" {
		subject = "Author access request"
	}
	if len(message) < 10 {
		return nil, fmt.Errorf("%w: message must be at least 10 characters", ErrValidation)
	}

	app := &models.AuthorApplication{
		UserID:         input.UserID,
		Subject:        subject,
		MessageBody:    message,
		Qualifications: message,
		Experience:     message,
		Status:         "PENDING",
	}
	if err := s.apps.Create(ctx, app); err != nil {
		return nil, err
	}

	if err := s.saveAttachments(ctx, input.BasePath, app.ID, input.Files); err != nil {
		return nil, err
	}

	actorID := input.UserID
	_ = s.audit.Record(ctx, &actorID, "AUTHOR_APPLICATION_SUBMITTED", "author_application", &app.ID, nil)

	senderName := user.Nickname
	if senderName == "" {
		senderName = formatUserFullName(user)
	}
	if senderName == "" {
		senderName = user.Email
	}

	_ = s.inbox.NotifyUser(ctx, input.UserID, nil, InboxTypeAuthorRequestAck,
		"Request sent",
		"Your author request has been sent. Please wait for an admin to reply.",
		&app.ID, nil)
	_ = s.inbox.NotifyAdmins(ctx, input.UserID, InboxTypeAuthorRequest,
		fmt.Sprintf("Author request from %s", senderName),
		fmt.Sprintf("Subject: %s\n\n%s", subject, message),
		&app.ID)

	view, err := s.enrichApplication(ctx, *app)
	if err != nil {
		return nil, err
	}
	return &view, nil
}

func (s *AuthorApplicationService) saveAttachments(ctx context.Context, basePath string, applicationID uuid.UUID, files []*multipart.FileHeader) error {
	if len(files) == 0 {
		return nil
	}
	dir := filepath.Join(basePath, "author-applications", applicationID.String())
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}

	for _, fileHeader := range files {
		if fileHeader.Size > 10<<20 {
			return fmt.Errorf("%w: attachment exceeds 10MB limit", ErrValidation)
		}
		src, err := fileHeader.Open()
		if err != nil {
			return err
		}
		storedName := uuid.New().String() + "_" + filepath.Base(fileHeader.Filename)
		destPath := filepath.Join(dir, storedName)
		dst, err := os.Create(destPath)
		if err != nil {
			_ = src.Close()
			return err
		}
		written, err := io.Copy(dst, src)
		_ = src.Close()
		_ = dst.Close()
		if err != nil {
			return err
		}
		attachment := &models.AuthorApplicationAttachment{
			ApplicationID: applicationID,
			FileName:      fileHeader.Filename,
			StoredPath:    destPath,
			MimeType:      fileHeader.Header.Get("Content-Type"),
			FileSize:      written,
		}
		if err := s.attachments.Create(ctx, attachment); err != nil {
			return err
		}
	}
	return nil
}

func (s *AuthorApplicationService) GetMine(ctx context.Context, userID uuid.UUID) (*AuthorApplicationView, error) {
	app, err := s.apps.FindLatestByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	view, err := s.enrichApplication(ctx, *app)
	if err != nil {
		return nil, err
	}
	return &view, nil
}

func (s *AuthorApplicationService) ListPending(ctx context.Context) ([]models.AuthorApplication, error) {
	return s.apps.ListByStatus(ctx, "PENDING")
}

func (s *AuthorApplicationService) ListPendingViews(ctx context.Context) ([]AuthorApplicationView, error) {
	apps, err := s.apps.ListByStatus(ctx, "PENDING")
	if err != nil {
		return nil, err
	}
	views := make([]AuthorApplicationView, 0, len(apps))
	for _, app := range apps {
		view, err := s.enrichApplication(ctx, app)
		if err != nil {
			return nil, err
		}
		views = append(views, view)
	}
	return views, nil
}

func (s *AuthorApplicationService) ListByStatus(ctx context.Context, status string) ([]models.AuthorApplication, error) {
	return s.apps.ListByStatus(ctx, status)
}

func (s *AuthorApplicationService) Reply(ctx context.Context, input ReplyAuthorRequestInput) (*AuthorApplicationView, error) {
	app, err := s.apps.FindByID(ctx, input.ApplicationID)
	if err != nil {
		return nil, err
	}
	if app.Status != "PENDING" && app.Status != "REPLIED" {
		return nil, ErrApplicationNotPending
	}
	if app.UserID == input.ReviewerID {
		return nil, fmt.Errorf("%w: cannot reply to your own request", ErrValidation)
	}

	reply := strings.TrimSpace(input.ReplyMessage)
	if reply == "" {
		return nil, fmt.Errorf("%w: reply message is required", ErrValidation)
	}

	var accessKey string
	if input.IncludeAccessKey {
		generated, err := s.accessKeys.GenerateFor(ctx, GenerateAccessKeyInput{
			CreatedBy:     input.ReviewerID,
			TTL:           7 * 24 * time.Hour,
			TargetRole:    roles.Author,
			ApplicationID: &app.ID,
		})
		if err != nil {
			return nil, err
		}
		accessKey = generated.PlainKey
		reply += "\n\nYour Admin Access key:\n" + accessKey
		reply += "\n\nRedeem the Admin Access key to become an Author."
	}

	now := time.Now()
	app.AdminReply = reply
	app.AdminReplyBy = &input.ReviewerID
	app.AdminReplyAt = &now
	app.RepliedAccessKey = accessKey
	app.Status = "REPLIED"
	app.UpdatedAt = now

	if err := s.apps.Update(ctx, app); err != nil {
		return nil, err
	}

	_ = s.audit.Record(ctx, &input.ReviewerID, "AUTHOR_APPLICATION_REPLIED", "author_application", &app.ID, map[string]any{
		"includeAccessKey": input.IncludeAccessKey,
	})

	_ = s.inbox.NotifyUser(ctx, app.UserID, &input.ReviewerID, InboxTypeAdminReply,
		"Reply to your author request",
		reply,
		&app.ID, map[string]any{
			"includeAccessKey": input.IncludeAccessKey,
		})

	view, err := s.enrichApplication(ctx, *app)
	if err != nil {
		return nil, err
	}
	return &view, nil
}

func (s *AuthorApplicationService) GetAttachment(ctx context.Context, requesterID uuid.UUID, requesterRole string, attachmentID uuid.UUID) (*models.AuthorApplicationAttachment, error) {
	attachment, err := s.attachments.FindByID(ctx, attachmentID)
	if err != nil {
		return nil, err
	}
	app, err := s.apps.FindByID(ctx, attachment.ApplicationID)
	if err != nil {
		return nil, err
	}
	if app.UserID != requesterID && !roles.HasAtLeast(requesterRole, roles.Admin) {
		return nil, repository.ErrApplicationNotFound
	}
	return attachment, nil
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
	if app.Status != "PENDING" && app.Status != "REPLIED" {
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
	body := "Your author request was not approved at this time."
	inboxType := InboxTypeAdminReply
	subject := "Author request update"
	if status == "APPROVED" {
		action = "AUTHOR_APPLICATION_APPROVED"
		inboxType = InboxTypeAuthorPromoted
		subject = "You are now an Author"
		body = "Your author request was approved by an admin. Open your Docket to start writing."
	}
	_ = s.inbox.NotifyUser(ctx, app.UserID, &reviewerID, inboxType,
		subject, body, &app.ID, nil)

	return s.audit.Record(ctx, &reviewerID, action, "author_application", &app.ID, map[string]any{
		"userId": app.UserID,
		"status": status,
	})
}
