package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/repository"
	"github.com/eukov/backend/internal/roles"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

const (
	DocumentStatusDraft     = "DRAFT"
	DocumentStatusPublished = "PUBLISHED"
	ContentFormatHTML       = "html"
	ContentFormatDocx       = "docx"
	minPublishContentLength = 200
)

var (
	ErrDocumentForbidden       = errors.New("forbidden")
	ErrDocumentNotDraft        = errors.New("document is not a draft")
	ErrDocumentNotPublished    = errors.New("document is not published")
	ErrPublishValidation       = errors.New("publish validation failed")
	ErrDraftContentRestricted  = errors.New("draft content is restricted")
)

type DocumentService struct {
	dockets     *repository.DocketRepository
	documents   *repository.DocumentRepository
	tags        *repository.DocumentTagRepository
	genres      *repository.GenreRepository
	metadata    *repository.DocumentMetadataRepository
	docketItems *repository.DocketItemRepository
	files       *DocumentFileService
	unpublish   *repository.UnpublishRepository
	auditEv     *repository.PublishAuditEventRepository
	audit       *AuditService
	inbox       *InboxService
}

func NewDocumentService(
	dockets *repository.DocketRepository,
	documents *repository.DocumentRepository,
	tags *repository.DocumentTagRepository,
	genres *repository.GenreRepository,
	metadata *repository.DocumentMetadataRepository,
	docketItems *repository.DocketItemRepository,
	files *DocumentFileService,
	unpublish *repository.UnpublishRepository,
	auditEv *repository.PublishAuditEventRepository,
	audit *AuditService,
	inbox *InboxService,
) *DocumentService {
	return &DocumentService{
		dockets:     dockets,
		documents:   documents,
		tags:        tags,
		genres:      genres,
		metadata:    metadata,
		docketItems: docketItems,
		files:       files,
		unpublish:   unpublish,
		auditEv:     auditEv,
		audit:       audit,
		inbox:       inbox,
	}
}

type DocumentView struct {
	ID          uuid.UUID  `json:"id"`
	Title       string     `json:"title"`
	Status      string     `json:"status"`
	GenreID     *uuid.UUID `json:"genreId,omitempty"`
	GenreName   string     `json:"genreName,omitempty"`
	Tags        []string   `json:"tags"`
	Content        string     `json:"content,omitempty"`
	ContentFormat  string     `json:"contentFormat,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	PublishedAt *time.Time `json:"publishedAt,omitempty"`
}

type CreateDocumentInput struct {
	Title         string `validate:"required,min=1,max=255"`
	Content       string
	ContentFormat string
	ReaderHtml    string
	CoverURL      string
}

type UpdateDocumentInput struct {
	Title         string `validate:"required,min=1,max=255"`
	Content       string
	ContentFormat string
	ReaderHtml    string
	CoverURL      string
	AuthorName    string
}

type PublishDocumentInput struct {
	Genre         string   `validate:"required"`
	Tags          []string `validate:"required,min=1,dive,required,max=50"`
	Title         string   `validate:"omitempty,min=1,max=255"`
	Content       string
	ContentFormat string
	ReaderHtml    string
	CoverURL      string
	AuthorName    string
}

func (s *DocumentService) CreateDraft(ctx context.Context, authorID uuid.UUID, input CreateDocumentInput) (*DocumentView, error) {
	docket, err := s.dockets.FindOrCreateForUser(ctx, authorID)
	if err != nil {
		return nil, err
	}

	docID := uuid.New()
	path, err := s.files.DocumentPath(authorID, docID)
	if err != nil {
		return nil, err
	}

	doc := &models.Document{
		ID:        docID,
		DocketID:  docket.ID,
		AuthorID:  authorID,
		Title:     strings.TrimSpace(input.Title),
		FilePath:  path,
		Status:    DocumentStatusDraft,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := s.documents.Create(ctx, doc); err != nil {
		return nil, err
	}
	if err := s.writeDraftContent(authorID, doc.ID, input.Content, input.ContentFormat, input.ReaderHtml); err != nil {
		return nil, err
	}
	_ = s.docketItems.Upsert(ctx, &models.DocketItem{
		UserID: authorID, ItemType: repository.DocketItemManuscript, ItemID: doc.ID,
	})

	_ = s.recordEvent(ctx, authorID, doc.ID, "DOCUMENT_CREATED", nil)
	return s.toView(ctx, doc, authorID, true, true)
}

func (s *DocumentService) UpdateDraft(ctx context.Context, authorID, documentID uuid.UUID, input UpdateDocumentInput) (*DocumentView, error) {
	doc, err := s.authorDraft(ctx, authorID, documentID)
	if err != nil {
		return nil, err
	}

	doc.Title = strings.TrimSpace(input.Title)
	doc.UpdatedAt = time.Now()
	if err := s.documents.Update(ctx, doc); err != nil {
		return nil, err
	}
	if err := s.writeDraftContent(authorID, doc.ID, input.Content, input.ContentFormat, input.ReaderHtml); err != nil {
		return nil, err
	}

	_ = s.recordEvent(ctx, authorID, doc.ID, "DOCUMENT_SAVED", nil)
	return s.toView(ctx, doc, authorID, true, true)
}

// PersistAuthorContent stores editor content for drafts or published books owned by the author.
// Published documents keep their status; only on-disk content (e.g. docx sidecar) is updated.
func (s *DocumentService) PersistAuthorContent(ctx context.Context, authorID, documentID uuid.UUID, input UpdateDocumentInput) (*DocumentView, error) {
	doc, err := s.authorOwnedDocument(ctx, authorID, documentID)
	if err != nil {
		return nil, err
	}

	if doc.Status == DocumentStatusDraft {
		doc.Title = strings.TrimSpace(input.Title)
		doc.UpdatedAt = time.Now()
		if err := s.documents.Update(ctx, doc); err != nil {
			return nil, err
		}
	}

	if err := s.writeDraftContent(authorID, doc.ID, input.Content, input.ContentFormat, input.ReaderHtml); err != nil {
		return nil, err
	}

	if doc.Status == DocumentStatusDraft {
		_ = s.recordEvent(ctx, authorID, doc.ID, "DOCUMENT_SAVED", nil)
	}
	return s.toView(ctx, doc, authorID, true, true)
}

func (s *DocumentService) FindOwnedDocument(ctx context.Context, authorID, documentID uuid.UUID) (*models.Document, error) {
	return s.authorOwnedDocument(ctx, authorID, documentID)
}

func (s *DocumentService) DeleteDraft(ctx context.Context, authorID, documentID uuid.UUID) error {
	doc, err := s.authorDraft(ctx, authorID, documentID)
	if err != nil {
		return err
	}
	_ = s.files.DeleteContent(authorID, doc.ID)
	if err := s.documents.Delete(ctx, doc.ID); err != nil {
		return err
	}
	_ = s.recordEvent(ctx, authorID, doc.ID, "DOCUMENT_DELETED", nil)
	return nil
}

func (s *DocumentService) Publish(ctx context.Context, authorID, documentID uuid.UUID, input PublishDocumentInput) (*DocumentView, error) {
	doc, err := s.authorDraft(ctx, authorID, documentID)
	if err != nil {
		return nil, err
	}

	readerHTML, docxBytes, err := s.resolvePublishContent(authorID, doc.ID, input)
	if err != nil {
		return nil, err
	}
	plain := StripHTML(readerHTML)
	if utf8.RuneCountInString(strings.TrimSpace(plain)) < minPublishContentLength {
		return nil, fmt.Errorf("%w: content must be at least %d characters", ErrPublishValidation, minPublishContentLength)
	}

	genreRecords, err := s.genres.FindByNames(ctx, []string{strings.TrimSpace(input.Genre)})
	if err != nil {
		return nil, fmt.Errorf("%w: invalid genre", ErrPublishValidation)
	}
	genre := genreRecords[0]

	tags := normalizeTags(input.Tags)
	if len(tags) == 0 {
		return nil, fmt.Errorf("%w: at least one keyword required", ErrPublishValidation)
	}

	title := strings.TrimSpace(input.Title)
	if title == "" {
		title = doc.Title
	}
	if title == "" {
		return nil, fmt.Errorf("%w: title required", ErrPublishValidation)
	}

	if len(docxBytes) > 0 {
		if err := s.files.WriteDocx(authorID, doc.ID, docxBytes); err != nil {
			return nil, err
		}
	}
	if err := s.files.WriteReaderHTML(authorID, doc.ID, readerHTML); err != nil {
		return nil, err
	}

	now := time.Now()
	doc.Title = title
	doc.GenreID = &genre.ID
	doc.Status = DocumentStatusPublished
	doc.PublishedAt = &now
	doc.UpdatedAt = now
	if err := s.documents.Update(ctx, doc); err != nil {
		return nil, err
	}
	if err := s.tags.ReplaceTags(ctx, doc.ID, tags); err != nil {
		return nil, err
	}
	_ = s.metadata.Upsert(ctx, &models.DocumentMetadata{
		DocumentID:  doc.ID,
		GenreID:     genre.ID,
		Summary:     DisplaySummary(readerHTML, 280),
		ReadingTime: estimateReadingMinutes(readerHTML),
		CoverURL:    ResolvePublishCoverURL(readerHTML, input.CoverURL),
		AuthorName:  strings.TrimSpace(input.AuthorName),
	})

	_ = s.recordEvent(ctx, authorID, doc.ID, "DOCUMENT_PUBLISHED", map[string]any{
		"genre": genre.Name,
		"tags":  tags,
	})
	actorID := authorID
	_ = s.audit.Record(ctx, &actorID, "DOCUMENT_PUBLISHED", "document", &doc.ID, map[string]any{
		"title": title,
	})

	return s.toView(ctx, doc, authorID, true, true)
}

func (s *DocumentService) GetDocument(ctx context.Context, requesterID uuid.UUID, requesterRole string, documentID uuid.UUID) (*DocumentView, error) {
	doc, err := s.documents.FindByID(ctx, documentID)
	if err != nil {
		return nil, err
	}

	authorID := doc.AuthorID
	if authorID == uuid.Nil {
		authorID, err = s.documents.AuthorIDForDocument(ctx, documentID)
		if err != nil {
			return nil, err
		}
	}

	includeContent := false
	if authorID == requesterID {
		includeContent = true
	} else if doc.Status == DocumentStatusPublished {
		includeContent = true
	} else if roles.HasAtLeast(requesterRole, roles.Admin) {
		// Admins see metadata only for others' drafts — never body content.
		includeContent = false
	} else {
		return nil, ErrDocumentForbidden
	}

	return s.toView(ctx, doc, authorID, includeContent, authorID == requesterID)
}

func (s *DocumentService) writeDraftContent(
	authorID, documentID uuid.UUID,
	content, contentFormat, readerHTML string,
) error {
	format := strings.TrimSpace(strings.ToLower(contentFormat))
	if format == "" {
		format = ContentFormatHTML
	}

	switch format {
	case ContentFormatDocx:
		docxBytes, err := DecodeDocxBase64(content)
		if err != nil {
			return err
		}
		if len(docxBytes) == 0 {
			return nil
		}
		if err := s.files.WriteDocx(authorID, documentID, docxBytes); err != nil {
			return err
		}
		if strings.TrimSpace(readerHTML) != "" {
			return s.files.WriteReaderHTML(authorID, documentID, readerHTML)
		}
		return nil
	default:
		return s.files.WriteContent(authorID, documentID, content)
	}
}

func (s *DocumentService) resolvePublishContent(
	authorID, documentID uuid.UUID,
	input PublishDocumentInput,
) (readerHTML string, docxBytes []byte, err error) {
	format := strings.TrimSpace(strings.ToLower(input.ContentFormat))
	if format == "" {
		format = ContentFormatHTML
	}

	switch format {
	case ContentFormatDocx:
		docxBytes, err = DecodeDocxBase64(input.Content)
		if err != nil {
			return "", nil, err
		}
		if len(docxBytes) == 0 {
			docxBytes, err = s.files.ReadDocx(authorID, documentID)
			if err != nil {
				return "", nil, err
			}
		}
		readerHTML = strings.TrimSpace(input.ReaderHtml)
		if readerHTML == "" {
			readerHTML, err = s.files.ReadReaderHTML(authorID, documentID)
			if err != nil {
				return "", nil, err
			}
		}
		if readerHTML == "" {
			return "", nil, fmt.Errorf("%w: readerHtml required for docx publish", ErrPublishValidation)
		}
		return readerHTML, docxBytes, nil
	default:
		readerHTML = strings.TrimSpace(input.Content)
		if readerHTML == "" {
			readerHTML, err = s.files.ReadContent(authorID, documentID)
			if err != nil {
				return "", nil, err
			}
		}
		return readerHTML, nil, nil
	}
}

func (s *DocumentService) loadDocumentContent(
	authorID, documentID uuid.UUID,
	requesterIsAuthor bool,
) (content, format string, err error) {
	if requesterIsAuthor {
		return s.files.ReadAuthorDraft(authorID, documentID)
	}
	html, err := s.files.ReadContent(authorID, documentID)
	return html, ContentFormatHTML, err
}

func (s *DocumentService) ReviewDraftContent(ctx context.Context, reviewerID uuid.UUID, documentID uuid.UUID) (*DocumentView, error) {
	doc, err := s.documents.FindByID(ctx, documentID)
	if err != nil {
		return nil, err
	}
	if doc.Status != DocumentStatusDraft {
		return nil, ErrDocumentNotDraft
	}
	authorID := doc.AuthorID
	_ = s.recordEvent(ctx, reviewerID, doc.ID, "ADMIN_REVIEWED_DRAFT", map[string]any{
		"reviewerId": reviewerID,
	})
	_ = s.audit.Record(ctx, &reviewerID, "ADMIN_REVIEWED_DRAFT", "document", &doc.ID, nil)
	return s.toView(ctx, doc, authorID, true, true)
}

func (s *DocumentService) ListDocuments(ctx context.Context, requesterID uuid.UUID, requesterRole string, mineOnly bool) ([]DocumentView, error) {
	var docs []models.Document
	var err error

	if mineOnly {
		docs, err = s.documents.ListByAuthor(ctx, requesterID)
	} else {
		docs, err = s.documents.ListPublished(ctx)
	}
	if err != nil {
		return nil, err
	}

	views := make([]DocumentView, 0, len(docs))
	for _, doc := range docs {
		authorID, err := s.documents.AuthorIDForDocument(ctx, doc.ID)
		if err != nil {
			continue
		}
		view, err := s.toView(ctx, &doc, authorID, false, false)
		if err != nil {
			continue
		}
		views = append(views, *view)
	}
	return views, nil
}

func (s *DocumentService) SubmitUnpublishRequest(ctx context.Context, authorID, documentID uuid.UUID, justification string) error {
	doc, err := s.documents.FindByID(ctx, documentID)
	if err != nil {
		return err
	}
	ownerID, err := s.documents.AuthorIDForDocument(ctx, documentID)
	if err != nil {
		return err
	}
	if ownerID != authorID {
		return ErrDocumentForbidden
	}
	if doc.Status != DocumentStatusPublished {
		return ErrDocumentNotPublished
	}

	req := &models.UnpublishRequest{
		DocumentID:    documentID,
		AuthorID:      authorID,
		Status:        "PENDING",
		Justification: strings.TrimSpace(justification),
	}
	if err := s.unpublish.Create(ctx, req); err != nil {
		return err
	}
	_ = s.recordEvent(ctx, authorID, documentID, "UNPUBLISH_REQUESTED", map[string]any{
		"requestId": req.ID,
	})
	return nil
}

func (s *DocumentService) TakedownPublished(ctx context.Context, authorID, documentID uuid.UUID) (*DocumentView, error) {
	doc, err := s.documents.FindByID(ctx, documentID)
	if err != nil {
		return nil, err
	}
	ownerID, err := s.documents.AuthorIDForDocument(ctx, documentID)
	if err != nil {
		return nil, err
	}
	if ownerID != authorID {
		return nil, ErrDocumentForbidden
	}
	if doc.Status != DocumentStatusPublished {
		return nil, ErrDocumentNotPublished
	}

	now := time.Now()
	doc.Status = DocumentStatusDraft
	doc.PublishedAt = nil
	doc.UpdatedAt = now
	if err := s.documents.Update(ctx, doc); err != nil {
		return nil, err
	}

	_ = s.recordEvent(ctx, authorID, doc.ID, "DOCUMENT_TAKEDOWN", nil)
	_ = s.audit.Record(ctx, &authorID, "DOCUMENT_TAKEDOWN", "document", &doc.ID, map[string]any{
		"title": doc.Title,
	})
	if s.inbox != nil {
		_ = s.inbox.NotifyScriptTakedown(ctx, authorID, doc.ID, doc.Title)
	}
	return s.toView(ctx, doc, authorID, true, true)
}

func (s *DocumentService) ListUnpublishRequests(ctx context.Context, status string) ([]models.UnpublishRequest, error) {
	if status == "" {
		status = "PENDING"
	}
	return s.unpublish.ListByStatus(ctx, status)
}

func (s *DocumentService) ApproveUnpublish(ctx context.Context, adminID, requestID uuid.UUID) error {
	return s.reviewUnpublish(ctx, adminID, requestID, "APPROVED")
}

func (s *DocumentService) RejectUnpublish(ctx context.Context, adminID, requestID uuid.UUID) error {
	return s.reviewUnpublish(ctx, adminID, requestID, "REJECTED")
}

func (s *DocumentService) reviewUnpublish(ctx context.Context, adminID, requestID uuid.UUID, status string) error {
	req, err := s.unpublish.FindByID(ctx, requestID)
	if err != nil {
		return err
	}
	if req.Status != "PENDING" {
		return errors.New("request is not pending")
	}

	now := time.Now()
	req.Status = status
	req.ActionedBy = &adminID
	req.ActionedAt = &now
	req.UpdatedAt = now
	if err := s.unpublish.Update(ctx, req); err != nil {
		return err
	}

	if status == "APPROVED" {
		doc, err := s.documents.FindByID(ctx, req.DocumentID)
		if err != nil {
			return err
		}
		doc.Status = DocumentStatusDraft
		doc.UpdatedAt = now
		if err := s.documents.Update(ctx, doc); err != nil {
			return err
		}
	}

	eventType := "UNPUBLISH_REJECTED"
	if status == "APPROVED" {
		eventType = "UNPUBLISH_APPROVED"
	}
	_ = s.recordEvent(ctx, adminID, req.DocumentID, eventType, map[string]any{
		"requestId": requestID,
	})
	_ = s.audit.Record(ctx, &adminID, eventType, "unpublish_request", &req.ID, map[string]any{
		"documentId": req.DocumentID,
	})
	return nil
}

func (s *DocumentService) authorOwnedDocument(ctx context.Context, authorID, documentID uuid.UUID) (*models.Document, error) {
	doc, err := s.documents.FindByID(ctx, documentID)
	if err != nil {
		return nil, err
	}
	ownerID, err := s.documents.AuthorIDForDocument(ctx, documentID)
	if err != nil {
		return nil, err
	}
	if ownerID != authorID {
		return nil, ErrDocumentForbidden
	}
	if doc.Status != DocumentStatusDraft && doc.Status != DocumentStatusPublished {
		return nil, ErrDocumentNotDraft
	}
	return doc, nil
}

func (s *DocumentService) authorDraft(ctx context.Context, authorID, documentID uuid.UUID) (*models.Document, error) {
	doc, err := s.documents.FindByID(ctx, documentID)
	if err != nil {
		return nil, err
	}
	ownerID, err := s.documents.AuthorIDForDocument(ctx, documentID)
	if err != nil {
		return nil, err
	}
	if ownerID != authorID {
		return nil, ErrDocumentForbidden
	}
	if doc.Status != DocumentStatusDraft {
		return nil, ErrDocumentNotDraft
	}
	return doc, nil
}

func (s *DocumentService) toView(
	ctx context.Context,
	doc *models.Document,
	authorID uuid.UUID,
	loadContent bool,
	requesterIsAuthor bool,
) (*DocumentView, error) {
	content := ""
	contentFormat := ""
	if loadContent {
		var err error
		content, contentFormat, err = s.loadDocumentContent(authorID, doc.ID, requesterIsAuthor)
		if err != nil {
			return nil, err
		}
	}

	tags, _ := s.tags.ListByDocument(ctx, doc.ID)
	view := &DocumentView{
		ID:            doc.ID,
		Title:         doc.Title,
		Status:        doc.Status,
		GenreID:       doc.GenreID,
		Tags:          tags,
		Content:       content,
		ContentFormat: contentFormat,
		CreatedAt:     doc.CreatedAt,
		UpdatedAt:     doc.UpdatedAt,
		PublishedAt:   doc.PublishedAt,
	}
	if doc.GenreID != nil {
		if genre, err := s.genres.FindByID(ctx, *doc.GenreID); err == nil {
			view.GenreName = genre.Name
		}
	}
	return view, nil
}

func (s *DocumentService) recordEvent(ctx context.Context, actorID, documentID uuid.UUID, eventType string, metadata map[string]any) error {
	raw, _ := json.Marshal(metadata)
	ev := &models.PublishAuditEvent{
		DocumentID: &documentID,
		ActorID:    &actorID,
		EventType:  eventType,
		Metadata:   datatypes.JSON(raw),
	}
	return s.auditEv.Create(ctx, ev)
}

func estimateReadingMinutes(content string) int {
	words := len(strings.Fields(content))
	minutes := words / 200
	if minutes < 1 {
		return 1
	}
	return minutes
}

func normalizeTags(tags []string) []string {
	out := make([]string, 0, len(tags))
	seen := make(map[string]struct{})
	for _, t := range tags {
		t = strings.TrimSpace(strings.ToLower(t))
		if t == "" || len(t) > 50 {
			continue
		}
		if _, ok := seen[t]; ok {
			continue
		}
		seen[t] = struct{}{}
		out = append(out, t)
	}
	return out
}
