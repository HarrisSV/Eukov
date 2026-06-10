package repository

import (
	"context"
	"errors"
	"time"

	"github.com/eukov/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrAccessKeyNotFound      = errors.New("access key not found")
	ErrApplicationNotFound    = errors.New("author application not found")
	ErrRefreshTokenNotFound   = errors.New("refresh token not found")
	ErrApplicationExists      = errors.New("pending author application already exists")
)

type AccessKeyRepository struct {
	db *gorm.DB
}

func NewAccessKeyRepository(db *gorm.DB) *AccessKeyRepository {
	return &AccessKeyRepository{db: db}
}

func (r *AccessKeyRepository) Create(ctx context.Context, key *models.AccessKey) error {
	if key.ID == uuid.Nil {
		key.ID = uuid.New()
	}
	return r.db.WithContext(ctx).Create(key).Error
}

func (r *AccessKeyRepository) FindActive(ctx context.Context) ([]models.AccessKey, error) {
	var keys []models.AccessKey
	err := r.db.WithContext(ctx).
		Where("status = ?", "ACTIVE").
		Where("expires_at > ?", time.Now()).
		Order("created_at DESC").
		Find(&keys).Error
	return keys, err
}

func (r *AccessKeyRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.AccessKey, error) {
	var key models.AccessKey
	result := r.db.WithContext(ctx).Where("id = ?", id).First(&key)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrAccessKeyNotFound
		}
		return nil, result.Error
	}
	return &key, nil
}

func (r *AccessKeyRepository) ListActiveUnconsumed(ctx context.Context) ([]models.AccessKey, error) {
	var keys []models.AccessKey
	err := r.db.WithContext(ctx).
		Where("status = ?", "ACTIVE").
		Where("expires_at > ?", time.Now()).
		Find(&keys).Error
	return keys, err
}

func (r *AccessKeyRepository) Update(ctx context.Context, key *models.AccessKey) error {
	return r.db.WithContext(ctx).Save(key).Error
}

type AuthorApplicationRepository struct {
	db *gorm.DB
}

func NewAuthorApplicationRepository(db *gorm.DB) *AuthorApplicationRepository {
	return &AuthorApplicationRepository{db: db}
}

func (r *AuthorApplicationRepository) Create(ctx context.Context, app *models.AuthorApplication) error {
	if app.ID == uuid.Nil {
		app.ID = uuid.New()
	}
	var count int64
	if err := r.db.WithContext(ctx).
		Model(&models.AuthorApplication{}).
		Where("user_id = ? AND status = ?", app.UserID, "PENDING").
		Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return ErrApplicationExists
	}
	return r.db.WithContext(ctx).Create(app).Error
}

func (r *AuthorApplicationRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.AuthorApplication, error) {
	var app models.AuthorApplication
	result := r.db.WithContext(ctx).Where("id = ?", id).First(&app)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrApplicationNotFound
		}
		return nil, result.Error
	}
	return &app, nil
}

func (r *AuthorApplicationRepository) ListByStatus(ctx context.Context, status string) ([]models.AuthorApplication, error) {
	var apps []models.AuthorApplication
	err := r.db.WithContext(ctx).
		Where("status = ?", status).
		Order("created_at ASC").
		Find(&apps).Error
	return apps, err
}

func (r *AuthorApplicationRepository) Update(ctx context.Context, app *models.AuthorApplication) error {
	return r.db.WithContext(ctx).Save(app).Error
}

type AuditLogRepository struct {
	db *gorm.DB
}

func NewAuditLogRepository(db *gorm.DB) *AuditLogRepository {
	return &AuditLogRepository{db: db}
}

func (r *AuditLogRepository) Create(ctx context.Context, log *models.AuditLog) error {
	if log.ID == uuid.Nil {
		log.ID = uuid.New()
	}
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *AuditLogRepository) ListRecent(ctx context.Context, limit int) ([]models.AuditLog, error) {
	var logs []models.AuditLog
	err := r.db.WithContext(ctx).
		Order("created_at DESC").
		Limit(limit).
		Find(&logs).Error
	return logs, err
}

type RefreshTokenRepository struct {
	db *gorm.DB
}

func NewRefreshTokenRepository(db *gorm.DB) *RefreshTokenRepository {
	return &RefreshTokenRepository{db: db}
}

func (r *RefreshTokenRepository) Create(ctx context.Context, token *models.RefreshToken) error {
	if token.ID == uuid.Nil {
		token.ID = uuid.New()
	}
	return r.db.WithContext(ctx).Create(token).Error
}

func (r *RefreshTokenRepository) FindByHash(ctx context.Context, hash string) (*models.RefreshToken, error) {
	var token models.RefreshToken
	result := r.db.WithContext(ctx).Where("token_hash = ?", hash).First(&token)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrRefreshTokenNotFound
		}
		return nil, result.Error
	}
	return &token, nil
}

func (r *RefreshTokenRepository) DeleteByHash(ctx context.Context, hash string) error {
	return r.db.WithContext(ctx).Where("token_hash = ?", hash).Delete(&models.RefreshToken{}).Error
}

func (r *RefreshTokenRepository) DeleteByUserID(ctx context.Context, userID uuid.UUID) error {
	return r.db.WithContext(ctx).Where("user_id = ?", userID).Delete(&models.RefreshToken{}).Error
}

func (r *UserRepository) UpdateRole(ctx context.Context, userID uuid.UUID, role string) error {
	return r.db.WithContext(ctx).Model(&models.User{}).
		Where("id = ?", userID).
		Updates(map[string]any{"role": role, "updated_at": time.Now()}).Error
}

func (r *UserRepository) IncrementTokenVersion(ctx context.Context, userID uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&models.User{}).
		Where("id = ?", userID).
		UpdateColumn("token_version", gorm.Expr("token_version + 1")).Error
}

func (r *UserRepository) HasRole(ctx context.Context, role string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.User{}).Where("role = ?", role).Count(&count).Error
	return count > 0, err
}

func (r *UserRepository) FindByRole(ctx context.Context, role string) (*models.User, error) {
	var user models.User
	result := r.db.WithContext(ctx).Where("role = ?", role).First(&user)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, result.Error
	}
	return &user, nil
}

func (r *UserRepository) FindByRoles(ctx context.Context, roleList []string) ([]models.User, error) {
	var users []models.User
	err := r.db.WithContext(ctx).
		Where("role IN ?", roleList).
		Order("email ASC").
		Find(&users).Error
	return users, err
}
