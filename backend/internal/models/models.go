package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type User struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Email        string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	PasswordHash string    `gorm:"type:text;not null" json:"-"`
	Role         string    `gorm:"type:varchar(50);not null;default:READER" json:"role"`
	TokenVersion int       `gorm:"not null;default:1" json:"-"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

func (User) TableName() string {
	return "users"
}

type Genre struct {
	ID   uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name string    `gorm:"type:varchar(100);uniqueIndex;not null" json:"name"`
}

func (Genre) TableName() string {
	return "genres"
}

type UserGenre struct {
	UserID  uuid.UUID `gorm:"type:uuid;primaryKey" json:"userId"`
	GenreID uuid.UUID `gorm:"type:uuid;primaryKey" json:"genreId"`
}

func (UserGenre) TableName() string {
	return "user_genres"
}

type Docket struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index" json:"userId"`
	Name      string    `gorm:"type:varchar(255);not null" json:"name"`
	CreatedAt time.Time `json:"createdAt"`
}

func (Docket) TableName() string {
	return "dockets"
}

type Document struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DocketID    uuid.UUID  `gorm:"type:uuid;not null;index" json:"docketId"`
	AuthorID    uuid.UUID  `gorm:"type:uuid;not null;index" json:"authorId"`
	Title       string     `gorm:"type:varchar(255);not null" json:"title"`
	FilePath    string     `gorm:"type:text;not null" json:"filePath"`
	Status      string     `gorm:"type:varchar(50);not null;default:DRAFT" json:"status"`
	GenreID     *uuid.UUID `gorm:"type:uuid" json:"genreId,omitempty"`
	PublishedAt *time.Time `json:"publishedAt,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

type DocumentMetadata struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DocumentID  uuid.UUID `gorm:"type:uuid;not null;uniqueIndex" json:"documentId"`
	GenreID     uuid.UUID `gorm:"type:uuid;not null" json:"genreId"`
	Summary     string    `gorm:"type:text;not null;default:''" json:"summary"`
	ReadingTime int       `gorm:"not null;default:0" json:"readingTime"`
	CreatedAt   time.Time `json:"createdAt"`
}

func (DocumentMetadata) TableName() string {
	return "document_metadata"
}

type DocketItem struct {
	ID       uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID   uuid.UUID `gorm:"type:uuid;not null;index" json:"userId"`
	ItemType string    `gorm:"type:varchar(50);not null" json:"itemType"`
	ItemID   uuid.UUID `gorm:"type:uuid;not null" json:"itemId"`
	SavedAt  time.Time `json:"savedAt"`
}

func (DocketItem) TableName() string {
	return "docket_items"
}

type DocumentTag struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DocumentID uuid.UUID `gorm:"type:uuid;not null;index" json:"documentId"`
	Tag        string    `gorm:"type:varchar(50);not null" json:"tag"`
	CreatedAt  time.Time `json:"createdAt"`
}

func (DocumentTag) TableName() string {
	return "document_tags"
}

type UnpublishRequest struct {
	ID            uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DocumentID    uuid.UUID  `gorm:"type:uuid;not null;index" json:"documentId"`
	AuthorID      uuid.UUID  `gorm:"type:uuid;not null" json:"authorId"`
	Status        string     `gorm:"type:varchar(50);not null;default:PENDING" json:"status"`
	Justification string     `gorm:"type:text;not null" json:"justification"`
	ActionedBy    *uuid.UUID `gorm:"type:uuid" json:"actionedBy,omitempty"`
	ActionedAt    *time.Time `json:"actionedAt,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}

func (UnpublishRequest) TableName() string {
	return "unpublish_requests"
}

type PublishAuditEvent struct {
	ID         uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DocumentID *uuid.UUID     `gorm:"type:uuid" json:"documentId,omitempty"`
	ActorID    *uuid.UUID     `gorm:"type:uuid" json:"actorId,omitempty"`
	EventType  string         `gorm:"type:varchar(100);not null" json:"eventType"`
	Metadata   datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"metadata"`
	CreatedAt  time.Time      `json:"createdAt"`
}

func (PublishAuditEvent) TableName() string {
	return "publish_audit_events"
}

func (Document) TableName() string {
	return "documents"
}

type AccessKey struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	KeyHash    string     `gorm:"type:text;not null" json:"-"`
	CreatedBy  uuid.UUID  `gorm:"type:uuid;not null" json:"createdBy"`
	ConsumedBy *uuid.UUID `gorm:"type:uuid" json:"consumedBy,omitempty"`
	ExpiresAt  time.Time  `json:"expiresAt"`
	ConsumedAt *time.Time `json:"consumedAt,omitempty"`
	Status     string     `gorm:"type:varchar(50);not null;default:ACTIVE" json:"status"`
	CreatedAt  time.Time  `json:"createdAt"`
}

func (AccessKey) TableName() string {
	return "access_keys"
}

type AuthorApplication struct {
	ID             uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID         uuid.UUID  `gorm:"type:uuid;not null;index" json:"userId"`
	Qualifications string     `gorm:"type:text;not null" json:"qualifications"`
	Experience     string     `gorm:"type:text;not null" json:"experience"`
	Status         string     `gorm:"type:varchar(50);not null;default:PENDING" json:"status"`
	ReviewedBy     *uuid.UUID `gorm:"type:uuid" json:"reviewedBy,omitempty"`
	ReviewedAt     *time.Time `json:"reviewedAt,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}

func (AuthorApplication) TableName() string {
	return "author_applications"
}

type AuditLog struct {
	ID         uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ActorID    *uuid.UUID     `gorm:"type:uuid" json:"actorId,omitempty"`
	Action     string         `gorm:"type:varchar(100);not null" json:"action"`
	EntityType string         `gorm:"type:varchar(100);not null" json:"entityType"`
	EntityID   *uuid.UUID     `gorm:"type:uuid" json:"entityId,omitempty"`
	Metadata   datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"metadata"`
	CreatedAt  time.Time      `json:"createdAt"`
}

func (AuditLog) TableName() string {
	return "audit_logs"
}

type RefreshToken struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index" json:"userId"`
	TokenHash string    `gorm:"type:text;not null;uniqueIndex" json:"-"`
	ExpiresAt time.Time `json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
}

func (RefreshToken) TableName() string {
	return "refresh_tokens"
}
