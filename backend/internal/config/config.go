package config

import (
	"fmt"
	"os"
)

type Config struct {
	DatabaseURL        string
	Port               string
	UploadBasePath     string
	CORSOrigin         string
	JWTSecret          string
	SuperAdminEmail    string
	SuperAdminPassword string
}

func Load() (*Config, error) {
	cfg := &Config{
		DatabaseURL:        getEnv("DATABASE_URL", ""),
		Port:               getEnv("BACKEND_PORT", "8080"),
		UploadBasePath:     getEnv("UPLOAD_BASE_PATH", "./uploads"),
		CORSOrigin:         getEnv("CORS_ORIGIN", "http://localhost:3000"),
		JWTSecret:          getEnv("JWT_SECRET", ""),
		SuperAdminEmail:    getEnv("SUPER_ADMIN_EMAIL", ""),
		SuperAdminPassword: getEnv("SUPER_ADMIN_PASSWORD", ""),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}
	if len(cfg.JWTSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET must be at least 32 characters")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
