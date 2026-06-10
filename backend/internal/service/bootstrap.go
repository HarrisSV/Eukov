package service

import (
	"context"
	"errors"

	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/repository"
	"github.com/eukov/backend/internal/roles"
	"golang.org/x/crypto/bcrypt"
)

func BootstrapSuperAdmin(ctx context.Context, users *repository.UserRepository, email, password string) error {
	if email == "" || password == "" {
		return nil
	}

	exists, err := users.HasRole(ctx, roles.SuperAdmin)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return err
	}

	user := &models.User{
		Email:        email,
		PasswordHash: string(hash),
		Role:         roles.SuperAdmin,
		TokenVersion: 1,
	}
	if err := users.Create(ctx, user); err != nil {
		if errors.Is(err, repository.ErrUserAlreadyExists) {
			existing, findErr := users.FindByEmail(ctx, email)
			if findErr != nil {
				return findErr
			}
			return users.UpdateRole(ctx, existing.ID, roles.SuperAdmin)
		}
		return err
	}
	return nil
}
