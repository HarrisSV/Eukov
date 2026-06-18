package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/eukov/backend/internal/api"
	"github.com/eukov/backend/internal/auth"
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

	ctx := context.Background()
	if err := service.BootstrapSuperAdmin(ctx, repository.NewUserRepository(db), cfg.SuperAdminEmail, cfg.SuperAdminPassword); err != nil {
		zapLogger.Fatal("super admin bootstrap failed", zap.Error(err))
	}

	storageSvc := service.NewStorageService(cfg.UploadBasePath)
	if err := storageSvc.EnsureDirectories(); err != nil {
		zapLogger.Fatal("storage setup failed", zap.Error(err))
	}

	userRepo := repository.NewUserRepository(db)
	genreRepo := repository.NewGenreRepository(db)
	prefRepo := repository.NewPreferenceRepository(db)
	accessKeyRepo := repository.NewAccessKeyRepository(db)
	authorAppRepo := repository.NewAuthorApplicationRepository(db)
	attachmentRepo := repository.NewApplicationAttachmentRepository(db)
	inboxRepo := repository.NewInboxRepository(db)
	auditRepo := repository.NewAuditLogRepository(db)
	refreshRepo := repository.NewRefreshTokenRepository(db)

	jwtSvc := auth.NewJWTService(cfg.JWTSecret, 15, 7)
	userSvc := service.NewUserService(userRepo)
	genreSvc := service.NewGenreService(genreRepo)
	prefSvc := service.NewPreferenceService(userRepo, genreRepo, prefRepo)
	sessionSvc := service.NewAuthSessionService(userRepo, refreshRepo, jwtSvc)
	auditSvc := service.NewAuditService(auditRepo)
	inboxSvc := service.NewInboxService(inboxRepo, userRepo)
	accessKeySvc := service.NewAccessKeyService(accessKeyRepo, userRepo, authorAppRepo, auditSvc, inboxSvc)
	authorAppSvc := service.NewAuthorApplicationService(authorAppRepo, attachmentRepo, userRepo, auditSvc, inboxSvc, accessKeySvc)

	docketRepo := repository.NewDocketRepository(db)
	documentRepo := repository.NewDocumentRepository(db)
	tagRepo := repository.NewDocumentTagRepository(db)
	unpublishRepo := repository.NewUnpublishRepository(db)
	fileSvc := service.NewDocumentFileService(cfg.UploadBasePath)
	metadataRepo := repository.NewDocumentMetadataRepository(db)
	docketItemRepo := repository.NewDocketItemRepository(db)
	publishAuditRepo := repository.NewPublishAuditEventRepository(db)
	documentSvc := service.NewDocumentService(
		docketRepo,
		documentRepo,
		tagRepo,
		genreRepo,
		metadataRepo,
		docketItemRepo,
		fileSvc,
		unpublishRepo,
		publishAuditRepo,
		auditSvc,
	)
	docketSvc := service.NewDocketService(docketItemRepo, documentRepo, tagRepo, genreRepo, metadataRepo)
	adminActivitySvc := service.NewAdminActivityService(userRepo, documentRepo, publishAuditRepo, unpublishRepo)

	authorSubRepo := repository.NewAuthorSubscriptionRepository(db)
	issuedBookRepo := repository.NewIssuedBookRepository(db)
	readingProgressRepo := repository.NewReadingProgressRepository(db)
	readerActivityRepo := repository.NewReaderActivityRepository(db)

	librarySvc := service.NewLibraryService(documentRepo, tagRepo, genreRepo)
	recommendationSvc := service.NewRecommendationService(documentRepo, tagRepo, readerActivityRepo, prefRepo)
	issuanceSvc := service.NewIssuanceService(issuedBookRepo, documentRepo, authorSubRepo, userRepo, readerActivityRepo, docketItemRepo, readingProgressRepo)
	subscriptionSvc := service.NewSubscriptionService(authorSubRepo, userRepo, docketItemRepo, auditSvc, issuanceSvc)
	progressSvc := service.NewProgressService(readingProgressRepo, issuanceSvc, readerActivityRepo, fileSvc, documentRepo)
	readingSvc := service.NewReadingService(documentRepo, fileSvc, issuanceSvc, readingProgressRepo)

	handler := api.NewHandler(
		userSvc,
		genreSvc,
		prefSvc,
		storageSvc,
		sessionSvc,
		accessKeySvc,
		authorAppSvc,
		auditSvc,
		inboxSvc,
		documentSvc,
		docketSvc,
		adminActivitySvc,
		librarySvc,
		recommendationSvc,
		subscriptionSvc,
		issuanceSvc,
		progressSvc,
		readingSvc,
	)

	authLimiter := middleware.NewRateLimiter(20, time.Minute)

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.RequestID())
	r.Use(middleware.Logger(zapLogger))
	r.Use(middleware.CORS(cfg.CORSOrigin))

	handler.RegisterRoutes(r, jwtSvc, authLimiter)

	addr := fmt.Sprintf(":%s", cfg.Port)
	zapLogger.Info("server starting", zap.String("addr", addr))
	if err := r.Run(addr); err != nil {
		zapLogger.Fatal("server failed", zap.Error(err))
	}
}
