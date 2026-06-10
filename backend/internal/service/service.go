package service

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/repository"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrValidation         = errors.New("validation error")
)

type RegisterInput struct {
	Email    string `validate:"required,email"`
	Password string `validate:"required,min=8"`
}

type RegisterResult struct {
	UserID uuid.UUID
}

type LoginInput struct {
	Email    string `validate:"required,email"`
	Password string `validate:"required,min=8"`
}

type LoginResult struct {
	UserID uuid.UUID
	Email  string
}

type PreferencesInput struct {
	UserID uuid.UUID `validate:"required"`
	Genres []string  `validate:"required,min=1,dive,required"`
}

type UserService struct {
	users *repository.UserRepository
}

func NewUserService(users *repository.UserRepository) *UserService {
	return &UserService{users: users}
}

func (s *UserService) Register(ctx context.Context, input RegisterInput) (*RegisterResult, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcryptCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	user := &models.User{
		Email:        input.Email,
		PasswordHash: string(hash),
		Role:         "READER",
	}

	if err := s.users.Create(ctx, user); err != nil {
		return nil, err
	}

	return &RegisterResult{UserID: user.ID}, nil
}

func (s *UserService) FindByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	return s.users.FindByID(ctx, id)
}

func (s *UserService) Login(ctx context.Context, input LoginInput) (*LoginResult, error) {
	user, err := s.users.FindByEmail(ctx, input.Email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	return &LoginResult{
		UserID: user.ID,
		Email:  user.Email,
	}, nil
}

type GenreService struct {
	genres *repository.GenreRepository
}

func NewGenreService(genres *repository.GenreRepository) *GenreService {
	return &GenreService{genres: genres}
}

func (s *GenreService) ListGenres(ctx context.Context) ([]models.Genre, error) {
	return s.genres.FindAll(ctx)
}

type PreferenceService struct {
	users       *repository.UserRepository
	genres      *repository.GenreRepository
	preferences *repository.PreferenceRepository
}

func NewPreferenceService(
	users *repository.UserRepository,
	genres *repository.GenreRepository,
	preferences *repository.PreferenceRepository,
) *PreferenceService {
	return &PreferenceService{
		users:       users,
		genres:      genres,
		preferences: preferences,
	}
}

func (s *PreferenceService) SavePreferences(ctx context.Context, input PreferencesInput) error {
	if _, err := s.users.FindByID(ctx, input.UserID); err != nil {
		return err
	}

	genreRecords, err := s.genres.FindByNames(ctx, input.Genres)
	if err != nil {
		return err
	}

	genreIDs := make([]uuid.UUID, len(genreRecords))
	for i, g := range genreRecords {
		genreIDs[i] = g.ID
	}

	return s.preferences.SaveUserGenres(ctx, input.UserID, genreIDs)
}

func (s *PreferenceService) GetUserPreferences(ctx context.Context, userID uuid.UUID) ([]string, error) {
	return s.preferences.GetUserGenreNames(ctx, userID)
}

type StorageService struct {
	basePath string
}

func NewStorageService(basePath string) *StorageService {
	return &StorageService{basePath: basePath}
}

func (s *StorageService) EnsureDirectories() error {
	dirs := []string{
		s.basePath,
		filepath.Join(s.basePath, "dockets"),
		filepath.Join(s.basePath, "documents"),
		filepath.Join(s.basePath, "temp"),
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return fmt.Errorf("create directory %s: %w", dir, err)
		}
	}

	return nil
}

func (s *StorageService) IsReady() bool {
	info, err := os.Stat(s.basePath)
	return err == nil && info.IsDir()
}
