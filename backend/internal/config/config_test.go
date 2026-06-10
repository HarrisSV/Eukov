package config

import "testing"

func TestLoadRequiresDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	_, err := Load()
	if err == nil {
		t.Fatal("expected error when DATABASE_URL is empty")
	}
}

func TestLoadRequiresJWTSecret(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost:5432/eukov?sslmode=disable")
	t.Setenv("JWT_SECRET", "")
	_, err := Load()
	if err == nil {
		t.Fatal("expected error when JWT_SECRET is empty")
	}
}

func TestLoadDefaults(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost:5432/eukov?sslmode=disable")
	t.Setenv("JWT_SECRET", "test-secret-key-32chars-minimum!")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("load config: %v", err)
	}

	if cfg.Port != "8080" {
		t.Fatalf("expected port 8080, got %s", cfg.Port)
	}

	if cfg.UploadBasePath != "./uploads" {
		t.Fatalf("expected ./uploads, got %s", cfg.UploadBasePath)
	}
}
