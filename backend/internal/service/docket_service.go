package service

import (
	"context"

	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/repository"
	"github.com/eukov/backend/internal/roles"
	"github.com/google/uuid"
)

type DocketService struct {
	docketItems *repository.DocketItemRepository
	documents   *repository.DocumentRepository
	tags        *repository.DocumentTagRepository
	genres      *repository.GenreRepository
	metadata    *repository.DocumentMetadataRepository
}

func NewDocketService(
	docketItems *repository.DocketItemRepository,
	documents *repository.DocumentRepository,
	tags *repository.DocumentTagRepository,
	genres *repository.GenreRepository,
	metadata *repository.DocumentMetadataRepository,
) *DocketService {
	return &DocketService{
		docketItems: docketItems,
		documents:   documents,
		tags:        tags,
		genres:      genres,
		metadata:    metadata,
	}
}

type DocketWorkspaceView struct {
	SubscribedItems  []DocketItemView `json:"subscribedItems"`
	SavedBooks       []DocketItemView `json:"savedBooks"`
	ReadingProgress  []any            `json:"readingProgress"`
	Drafts           []DocumentView   `json:"drafts"`
	Published        []DocumentView   `json:"published"`
	IsAuthor         bool             `json:"isAuthor"`
	DraftCount       int              `json:"draftCount"`
	PublishedCount   int              `json:"publishedCount"`
}

type DocketItemView struct {
	ID       string `json:"id"`
	ItemType string `json:"itemType"`
	ItemID   string `json:"itemId"`
	Title    string `json:"title,omitempty"`
	Status   string `json:"status,omitempty"`
}

func (s *DocketService) GetWorkspace(ctx context.Context, userID uuid.UUID, role string) (*DocketWorkspaceView, error) {
	view := &DocketWorkspaceView{
		SubscribedItems: []DocketItemView{},
		SavedBooks:      []DocketItemView{},
		ReadingProgress: []any{},
		Drafts:          []DocumentView{},
		Published:       []DocumentView{},
		IsAuthor:        roles.HasAtLeast(role, roles.Author),
	}

	subs, _ := s.docketItems.ListByUserAndType(ctx, userID, repository.DocketItemLibrarySub)
	for _, item := range subs {
		view.SubscribedItems = append(view.SubscribedItems, DocketItemView{
			ID: item.ID.String(), ItemType: item.ItemType, ItemID: item.ItemID.String(),
		})
	}

	if !view.IsAuthor {
		return view, nil
	}

	docs, err := s.documents.ListByAuthor(ctx, userID)
	if err != nil {
		return nil, err
	}

	for _, doc := range docs {
		summary := DocumentView{
			ID:        doc.ID,
			Title:     doc.Title,
			Status:    doc.Status,
			GenreID:   doc.GenreID,
			CreatedAt: doc.CreatedAt,
			UpdatedAt: doc.UpdatedAt,
		}
		if doc.PublishedAt != nil {
			summary.PublishedAt = doc.PublishedAt
		}
		tags, _ := s.tags.ListByDocument(ctx, doc.ID)
		summary.Tags = tags
		if doc.GenreID != nil {
			if g, err := s.genres.FindByID(ctx, *doc.GenreID); err == nil {
				summary.GenreName = g.Name
			}
		}
		if doc.Status == DocumentStatusDraft {
			view.Drafts = append(view.Drafts, summary)
		} else {
			view.Published = append(view.Published, summary)
		}
	}

	view.DraftCount = len(view.Drafts)
	view.PublishedCount = len(view.Published)
	return view, nil
}

func (s *DocketService) RegisterManuscriptItem(ctx context.Context, userID, documentID uuid.UUID) error {
	return s.docketItems.Upsert(ctx, &models.DocketItem{
		UserID:   userID,
		ItemType: repository.DocketItemManuscript,
		ItemID:   documentID,
	})
}
