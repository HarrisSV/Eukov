package config

import "testing"

func TestLoadDefaults(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
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
