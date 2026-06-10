package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type ipLimiter struct {
	count    int
	resetAt  time.Time
}

type RateLimiter struct {
	mu       sync.Mutex
	limiters map[string]*ipLimiter
	limit    int
	window   time.Duration
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		limiters: make(map[string]*ipLimiter),
		limit:    limit,
		window:   window,
	}
}

func (r *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()

		r.mu.Lock()
		entry, ok := r.limiters[ip]
		if !ok || now.After(entry.resetAt) {
			entry = &ipLimiter{count: 0, resetAt: now.Add(r.window)}
			r.limiters[ip] = entry
		}
		entry.count++
		allowed := entry.count <= r.limit
		r.mu.Unlock()

		if !allowed {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
			return
		}
		c.Next()
	}
}
