package main

import (
	"fmt"
	"log"

	"github.com/eukov/backend/internal/api"
	"github.com/eukov/backend/internal/config"
	"github.com/eukov/backend/internal/middleware"
	"github.com/eukov/backend/internal/repository"
	"github.com/eukov/backend/internal/service"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	zapLogger, err := zap.NewProduction()
	if err != nil {
		log.Fatalf("logger: %v", err)
	}
	defer zapLogger.Sync()

	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		zapLogger.Fatal("database connection failed", zap.Error(err))
	}

	storageSvc := service.NewStorageService(cfg.UploadBasePath)
	if err := storageSvc.EnsureDirectories(); err != nil {
		zapLogger.Fatal("storage setup failed", zap.Error(err))
	}

	userRepo := repository.NewUserRepository(db)
	genreRepo := repository.NewGenreRepository(db)
	prefRepo := repository.NewPreferenceRepository(db)

	userSvc := service.NewUserService(userRepo)
	genreSvc := service.NewGenreService(genreRepo)
	prefSvc := service.NewPreferenceService(userRepo, genreRepo, prefRepo)

	handler := api.NewHandler(userSvc, genreSvc, prefSvc, storageSvc)

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.RequestID())
	r.Use(middleware.Logger(zapLogger))
	r.Use(middleware.CORS(cfg.CORSOrigin))

	handler.RegisterRoutes(r)

	addr := fmt.Sprintf(":%s", cfg.Port)
	zapLogger.Info("server starting", zap.String("addr", addr))
	if err := r.Run(addr); err != nil {
		zapLogger.Fatal("server failed", zap.Error(err))
	}
}
