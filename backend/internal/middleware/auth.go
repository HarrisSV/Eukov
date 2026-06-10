package middleware

import (
	"net/http"
	"strings"

	"github.com/eukov/backend/internal/auth"
	"github.com/eukov/backend/internal/models"
	"github.com/eukov/backend/internal/roles"
	"github.com/eukov/backend/internal/service"
	"github.com/gin-gonic/gin"
)

const (
	ContextUserKey   = "auth_user"
	ContextClaimsKey = "auth_claims"
)

func Authenticate(sessions *service.AuthSessionService, jwtSvc *auth.JWTService) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing or invalid authorization header"})
			return
		}

		token := strings.TrimPrefix(header, "Bearer ")
		claims, err := jwtSvc.ParseAccessToken(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		user, err := sessions.ValidateAccessClaims(c.Request.Context(), claims)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		c.Set(ContextUserKey, user)
		c.Set(ContextClaimsKey, claims)
		c.Next()
	}
}

func RequireRole(required string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userValue, exists := c.Get(ContextUserKey)
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		user, ok := userValue.(*models.User)
		if !ok || !roles.HasAtLeast(user.Role, required) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
			return
		}
		c.Next()
	}
}

func GetAuthUser(c *gin.Context) (*models.User, bool) {
	value, ok := c.Get(ContextUserKey)
	if !ok {
		return nil, false
	}
	user, ok := value.(*models.User)
	return user, ok
}
