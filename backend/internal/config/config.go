package config

import (
	"fmt"
	"os"
)

type Config struct {
	DatabaseURL   string
	Port          string
	UploadBasePath string
	CORSOrigin    string
}

func Load() (*Config, error) {
	cfg := &Config{
		DatabaseURL:    getEnv("DATABASE_URL", ""),
		Port:           getEnv("BACKEND_PORT", "8080"),
		UploadBasePath: getEnv("UPLOAD_BASE_PATH", "./uploads"),
		CORSOrigin:     getEnv("CORS_ORIGIN", "http://localhost:3000"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
