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
	progress  *repository.ReadingProgressRepository
	ai        *AIService
}

func NewRecommendationService(
	documents *repository.DocumentRepository,
	tags *repository.DocumentTagRepository,
	activity *repository.ReaderActivityRepository,
	prefs *repository.PreferenceRepository,
	progress *repository.ReadingProgressRepository,
	ai *AIService,
) *RecommendationService {
	return &RecommendationService{
		documents: documents,
		tags:      tags,
		activity:  activity,
		prefs:     prefs,
		progress:  progress,
		ai:        ai,
	}
}

type RecommendedBook struct {
	LibraryBookView
	Score  int    `json:"score"`
	Reason string `json:"reason,omitempty"`
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
	genreNames, err := s.prefs.GetUserGenreNames(ctx, readerID)
	if err != nil {
		return nil, err
	}

	activity, err := s.activity.ListByReader(ctx, readerID, 100)
	if err != nil {
		return nil, err
	}
	activityDocs := make(map[uuid.UUID]struct{}, len(activity))
	activityTypes := make(map[string]int, len(activity))
	for _, a := range activity {
		activityDocs[a.DocumentID] = struct{}{}
		activityTypes[a.ActivityType]++
	}

	progressRows, err := s.progress.ListByReader(ctx, readerID)
	if err != nil {
		return nil, err
	}
	progressDocs := make(map[uuid.UUID]modelsReadingProgressLite, len(progressRows))
	for _, row := range progressRows {
		progressDocs[row.DocumentID] = modelsReadingProgressLite{
			CurrentPage:          row.CurrentPage,
			CompletionPercentage: row.CompletionPercentage,
		}
	}

	recs := make([]RecommendedBook, 0, len(rows))
	tagFrequency := make(map[string]int)
	readTitles := make([]string, 0, 16)
	inProgressTitles := make([]string, 0, 8)

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
		if progress, ok := progressDocs[row.ID]; ok {
			if progress.CompletionPercentage >= 95 {
				score += 8
			} else if progress.CurrentPage > 1 {
				score += 6
			}
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
		for _, tag := range tagNames {
			tagFrequency[tag]++
		}
		if _, ok := activityDocs[row.ID]; ok {
			readTitles = appendUniqueTitle(readTitles, row.Title)
		}
		if progress, ok := progressDocs[row.ID]; ok && progress.CurrentPage > 1 && progress.CompletionPercentage < 95 {
			inProgressTitles = appendUniqueTitle(inProgressTitles, row.Title)
		}

		recs = append(recs, RecommendedBook{
			LibraryBookView: LibraryBookView{
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

	candidateLimit := limit * 3
	if candidateLimit < 12 {
		candidateLimit = 12
	}
	if len(recs) > candidateLimit {
		recs = recs[:candidateLimit]
	}

	if s.ai != nil && s.ai.Enabled() {
		profile := ReaderInterestProfile{
			GenreNames:       genreNames,
			ReadTitles:       readTitles,
			InProgressTitles: inProgressTitles,
			ActivityTypes:    activityTypes,
			TagFrequency:     tagFrequency,
		}
		if reranked, err := s.ai.RerankRecommendations(ctx, profile, recs, limit); err == nil && len(reranked) > 0 {
			return reranked, nil
		}
	}

	if len(recs) > limit {
		recs = recs[:limit]
	}
	return recs, nil
}

type modelsReadingProgressLite struct {
	CurrentPage          int
	CompletionPercentage float64
}

func appendUniqueTitle(items []string, title string) []string {
	for _, existing := range items {
		if existing == title {
			return items
		}
	}
	return append(items, title)
}
