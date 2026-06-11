package service

import (
	"context"

	"github.com/eukov/backend/internal/repository"
	"github.com/google/uuid"
)

type ReadingService struct {
	documents *repository.DocumentRepository
	files     *DocumentFileService
	issuance  *IssuanceService
	progress  *repository.ReadingProgressRepository
}

func NewReadingService(
	documents *repository.DocumentRepository,
	files *DocumentFileService,
	issuance *IssuanceService,
	progress *repository.ReadingProgressRepository,
) *ReadingService {
	return &ReadingService{
		documents: documents,
		files:     files,
		issuance:  issuance,
		progress:  progress,
	}
}

type PageView struct {
	DocumentID uuid.UUID `json:"documentId"`
	Title      string    `json:"title"`
	Page       int       `json:"page"`
	TotalPages int       `json:"totalPages"`
	Content    string    `json:"content"`
}

func (s *ReadingService) GetPage(ctx context.Context, readerID, documentID uuid.UUID, page int) (*PageView, error) {
	ok, err := s.issuance.HasAccess(ctx, readerID, documentID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrReaderForbidden
	}
	doc, err := s.documents.FindByID(ctx, documentID)
	if err != nil {
		if err == repository.ErrDocumentNotFound {
			return nil, ErrReaderNotFound
		}
		return nil, err
	}
	content, err := s.files.ReadContent(doc.AuthorID, documentID)
	if err != nil {
		return nil, err
	}
	plain := StripHTML(content)
	text, total, err := PageAt(plain, page, DefaultPageSize)
	if err != nil {
		return nil, err
	}
	_ = s.issuance.TouchOpened(ctx, readerID, documentID)
	return &PageView{
		DocumentID: documentID,
		Title:      doc.Title,
		Page:       page,
		TotalPages: total,
		Content:    text,
	}, nil
}

type ReaderDocketBook struct {
	DocumentID           uuid.UUID `json:"documentId"`
	Title                string    `json:"title"`
	IssuedAt             string    `json:"issuedAt"`
	LastOpenedAt         *string   `json:"lastOpenedAt,omitempty"`
	CurrentPage          int       `json:"currentPage"`
	CompletionPercentage float64   `json:"completionPercentage"`
}

func (s *ReadingService) ListDocketBooks(ctx context.Context, readerID uuid.UUID) ([]ReaderDocketBook, error) {
	issued, err := s.issuance.ListByReader(ctx, readerID)
	if err != nil {
		return nil, err
	}
	out := make([]ReaderDocketBook, 0, len(issued))
	for _, book := range issued {
		doc, err := s.documents.FindByID(ctx, book.DocumentID)
		if err != nil {
			continue
		}
		prog, _ := s.progress.Find(ctx, readerID, book.DocumentID)
		currentPage := 1
		pct := 0.0
		if prog != nil {
			currentPage = prog.CurrentPage
			pct = prog.CompletionPercentage
		}
		var lastOpened *string
		if book.LastOpenedAt != nil {
			t := book.LastOpenedAt.UTC().Format("2006-01-02T15:04:05Z07:00")
			lastOpened = &t
		}
		out = append(out, ReaderDocketBook{
			DocumentID:           book.DocumentID,
			Title:                doc.Title,
			IssuedAt:             book.IssuedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
			LastOpenedAt:         lastOpened,
			CurrentPage:          currentPage,
			CompletionPercentage: pct,
		})
	}
	return out, nil
}

const PreviewWordLimit = 250

type BookPreview struct {
	DocumentID    uuid.UUID `json:"documentId"`
	Title         string    `json:"title"`
	AuthorID      uuid.UUID `json:"authorId"`
	AuthorEmail   string    `json:"authorEmail"`
	PreviewText   string    `json:"previewText"`
	WordCount     int       `json:"wordCount"`
	TotalWords    int       `json:"totalWords"`
	RequiresSub   bool      `json:"requiresSubscription"`
	HasAccess     bool      `json:"hasAccess"`
	IsSubscribed  bool      `json:"isSubscribed"`
}

func (s *ReadingService) GetPreview(ctx context.Context, readerID, documentID uuid.UUID) (*BookPreview, error) {
	ok, err := s.issuance.HasPreviewAccess(ctx, documentID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrReaderNotFound
	}
	doc, err := s.documents.FindByID(ctx, documentID)
	if err != nil {
		return nil, err
	}
	content, err := s.files.ReadContent(doc.AuthorID, documentID)
	if err != nil {
		return nil, err
	}
	totalWords := WordCount(content)
	preview := FirstNWords(content, PreviewWordLimit)
	hasAccess, err := s.issuance.HasAccess(ctx, readerID, documentID)
	if err != nil {
		return nil, err
	}
	subscribed := false
	if _, err := s.issuance.subs.Find(ctx, readerID, doc.AuthorID); err == nil {
		subscribed = true
	}
	authorEmail := ""
	if author, err := s.issuance.users.FindByID(ctx, doc.AuthorID); err == nil {
		authorEmail = author.Email
	}
	return &BookPreview{
		DocumentID:   documentID,
		Title:        doc.Title,
		AuthorID:     doc.AuthorID,
		AuthorEmail:  authorEmail,
		PreviewText:  preview,
		WordCount:    len(SplitWords(preview)),
		TotalWords:   totalWords,
		RequiresSub:  totalWords > PreviewWordLimit,
		HasAccess:    hasAccess,
		IsSubscribed: subscribed,
	}, nil
}
