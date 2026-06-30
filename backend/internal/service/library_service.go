package service

import (
	"context"
	"time"

	"github.com/eukov/backend/internal/repository"
	"github.com/google/uuid"
)

type LibraryService struct {
	documents *repository.DocumentRepository
	tags      *repository.DocumentTagRepository
	genres    *repository.GenreRepository
}

func NewLibraryService(
	documents *repository.DocumentRepository,
	tags *repository.DocumentTagRepository,
	genres *repository.GenreRepository,
) *LibraryService {
	return &LibraryService{documents: documents, tags: tags, genres: genres}
}

type LibraryBookView struct {
	ID          uuid.UUID  `json:"id"`
	Title       string     `json:"title"`
	AuthorID    uuid.UUID  `json:"authorId"`
	AuthorEmail string     `json:"authorEmail"`
	AuthorName  string     `json:"authorName,omitempty"`
	GenreID     *uuid.UUID `json:"genreId,omitempty"`
	GenreName   string     `json:"genreName,omitempty"`
	Summary     string     `json:"summary,omitempty"`
	CoverURL    string     `json:"coverUrl,omitempty"`
	Tags        []string   `json:"tags"`
	OpenCount   int64      `json:"openCount"`
	PublishedAt *time.Time `json:"publishedAt,omitempty"`
}

func (s *LibraryService) List(ctx context.Context, params repository.LibrarySearchParams) ([]LibraryBookView, error) {
	rows, err := s.documents.SearchPublished(ctx, params)
	if err != nil {
		return nil, err
	}
	out := make([]LibraryBookView, 0, len(rows))
	for _, row := range rows {
		tagNames, err := s.tags.ListByDocument(ctx, row.ID)
		if err != nil {
			return nil, err
		}
		out = append(out, LibraryBookView{
			ID:          row.ID,
			Title:       row.Title,
			AuthorID:    row.AuthorID,
			AuthorEmail: row.AuthorEmail,
			AuthorName:  row.AuthorName,
			GenreID:     row.GenreID,
			GenreName:   row.GenreName,
			Summary:     DisplaySummary(row.Summary, 280),
			CoverURL:    row.CoverURL,
			Tags:        tagNames,
			OpenCount:   row.OpenCount,
			PublishedAt: row.PublishedAt,
		})
	}
	return out, nil
}
