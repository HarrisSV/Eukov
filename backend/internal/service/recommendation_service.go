package service

import (
	"context"
	"sort"
	"time"

	"github.com/eukov/backend/internal/repository"
	"github.com/google/uuid"
)

type RecommendationService struct {
	documents *repository.DocumentRepository
	tags      *repository.DocumentTagRepository
	activity  *repository.ReaderActivityRepository
	prefs     *repository.PreferenceRepository
}

func NewRecommendationService(
	documents *repository.DocumentRepository,
	tags *repository.DocumentTagRepository,
	activity *repository.ReaderActivityRepository,
	prefs *repository.PreferenceRepository,
) *RecommendationService {
	return &RecommendationService{
		documents: documents,
		tags:      tags,
		activity:  activity,
		prefs:     prefs,
	}
}

type RecommendedBook struct {
	LibraryBookView
	Score int `json:"score"`
}

func (s *RecommendationService) Recommend(ctx context.Context, readerID uuid.UUID, limit int) ([]RecommendedBook, error) {
	if limit <= 0 {
		limit = 8
	}
	rows, err := s.documents.SearchPublished(ctx, repository.LibrarySearchParams{Sort: "newest"})
	if err != nil {
		return nil, err
	}
	readerGenres, err := s.prefs.GetUserGenreIDs(ctx, readerID)
	if err != nil {
		return nil, err
	}
	genreSet := make(map[uuid.UUID]struct{}, len(readerGenres))
	for _, id := range readerGenres {
		genreSet[id] = struct{}{}
	}
	activity, err := s.activity.ListByReader(ctx, readerID, 50)
	if err != nil {
		return nil, err
	}
	activityDocs := make(map[uuid.UUID]struct{}, len(activity))
	for _, a := range activity {
		activityDocs[a.DocumentID] = struct{}{}
	}

	recs := make([]RecommendedBook, 0, len(rows))
	for _, row := range rows {
		score := 0
		if row.GenreID != nil {
			if _, ok := genreSet[*row.GenreID]; ok {
				score += 10
			}
		}
		if _, ok := activityDocs[row.ID]; ok {
			score += 5
		}
		if row.PublishedAt != nil {
			days := int(time.Since(*row.PublishedAt).Hours() / 24)
			if days < 30 {
				score += 3
			} else if days < 90 {
				score += 1
			}
		}
		tagNames, err := s.tags.ListByDocument(ctx, row.ID)
		if err != nil {
			return nil, err
		}
		recs = append(recs, RecommendedBook{
			LibraryBookView: LibraryBookView{
				ID:          row.ID,
				Title:       row.Title,
				AuthorID:    row.AuthorID,
				AuthorEmail: row.AuthorEmail,
				GenreID:     row.GenreID,
				GenreName:   row.GenreName,
				Summary:     row.Summary,
				Tags:        tagNames,
				OpenCount:   row.OpenCount,
				PublishedAt: row.PublishedAt,
			},
			Score: score,
		})
	}
	sort.Slice(recs, func(i, j int) bool {
		if recs[i].Score != recs[j].Score {
			return recs[i].Score > recs[j].Score
		}
		ti, tj := time.Time{}, time.Time{}
		if recs[i].PublishedAt != nil {
			ti = *recs[i].PublishedAt
		}
		if recs[j].PublishedAt != nil {
			tj = *recs[j].PublishedAt
		}
		return ti.After(tj)
	})
	if len(recs) > limit {
		recs = recs[:limit]
	}
	return recs, nil
}
