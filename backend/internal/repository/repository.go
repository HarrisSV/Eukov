package repository

import (
	"context"
	"errors"

	"github.com/eukov/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrUserNotFound      = errors.New("user not found")
	ErrUserAlreadyExists = errors.New("user already exists")
	ErrGenreNotFound     = errors.New("genre not found")
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(ctx context.Context, user *models.User) error {
	if user.ID == uuid.Nil {
		user.ID = uuid.New()
	}

	existing, err := r.FindByEmail(ctx, user.Email)
	if err != nil && !errors.Is(err, ErrUserNotFound) {
		return err
	}
	if existing != nil {
		return ErrUserAlreadyExists
	}

	result := r.db.WithContext(ctx).Create(user)
	if result.Error != nil {
		return result.Error
	}
	return nil
}

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	var user models.User
	result := r.db.WithContext(ctx).Where("email = ?", email).First(&user)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, result.Error
	}
	return &user, nil
}

func (r *UserRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	var user models.User
	result := r.db.WithContext(ctx).Where("id = ?", id).First(&user)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, result.Error
	}
	return &user, nil
}

type GenreRepository struct {
	db *gorm.DB
}

func NewGenreRepository(db *gorm.DB) *GenreRepository {
	return &GenreRepository{db: db}
}

func (r *GenreRepository) FindAll(ctx context.Context) ([]models.Genre, error) {
	var genres []models.Genre
	result := r.db.WithContext(ctx).Order("name ASC").Find(&genres)
	return genres, result.Error
}

func (r *GenreRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.Genre, error) {
	var genre models.Genre
	result := r.db.WithContext(ctx).Where("id = ?", id).First(&genre)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrGenreNotFound
		}
		return nil, result.Error
	}
	return &genre, nil
}

func (r *GenreRepository) FindByNames(ctx context.Context, names []string) ([]models.Genre, error) {
	var genres []models.Genre
	result := r.db.WithContext(ctx).Where("name IN ?", names).Find(&genres)
	if result.Error != nil {
		return nil, result.Error
	}
	if len(genres) != len(names) {
		return nil, ErrGenreNotFound
	}
	return genres, nil
}

type PreferenceRepository struct {
	db *gorm.DB
}

func NewPreferenceRepository(db *gorm.DB) *PreferenceRepository {
	return &PreferenceRepository{db: db}
}

func (r *PreferenceRepository) SaveUserGenres(ctx context.Context, userID uuid.UUID, genreIDs []uuid.UUID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ?", userID).Delete(&models.UserGenre{}).Error; err != nil {
			return err
		}

		if len(genreIDs) == 0 {
			return nil
		}

		records := make([]models.UserGenre, len(genreIDs))
		for i, genreID := range genreIDs {
			records[i] = models.UserGenre{
				UserID:  userID,
				GenreID: genreID,
			}
		}

		return tx.Create(&records).Error
	})
}

func (r *PreferenceRepository) GetUserGenreIDs(ctx context.Context, userID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := r.db.WithContext(ctx).
		Model(&models.UserGenre{}).
		Where("user_id = ?", userID).
		Pluck("genre_id", &ids).Error
	return ids, err
}

func (r *PreferenceRepository) GetUserGenreNames(ctx context.Context, userID uuid.UUID) ([]string, error) {
	var names []string
	err := r.db.WithContext(ctx).
		Table("user_genres").
		Select("genres.name").
		Joins("JOIN genres ON genres.id = user_genres.genre_id").
		Where("user_genres.user_id = ?", userID).
		Order("genres.name ASC").
		Pluck("genres.name", &names).Error
	return names, err
}
