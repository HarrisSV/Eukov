package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Email        string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	PasswordHash string    `gorm:"type:text;not null" json:"-"`
	Role         string    `gorm:"type:varchar(50);not null;default:READER" json:"role"`
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
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DocketID  uuid.UUID `gorm:"type:uuid;not null;index" json:"docketId"`
	Title     string    `gorm:"type:varchar(255);not null" json:"title"`
	FilePath  string    `gorm:"type:text;not null" json:"filePath"`
	Status    string    `gorm:"type:varchar(50);not null;default:DRAFT" json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

func (Document) TableName() string {
	return "documents"
}
