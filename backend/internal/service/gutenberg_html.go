package service

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var gutenbergRelativeMediaRe = regexp.MustCompile(`(?i)\b(src)\s*=\s*["'](images/[^"']+)["']`)

// GutenbergIDFromTags returns the numeric Project Gutenberg id from tags like gutenberg-34030.
func GutenbergIDFromTags(tags []string) string {
	for _, tag := range tags {
		if !strings.HasPrefix(tag, "gutenberg-") {
			continue
		}
		id := strings.TrimPrefix(tag, "gutenberg-")
		if id == "" {
			continue
		}
		if _, err := strconv.Atoi(id); err == nil {
			return id
		}
	}
	return ""
}

// RewriteGutenbergMediaURLs turns relative illustration paths into absolute gutenberg.org URLs.
func RewriteGutenbergMediaURLs(html, gutenbergID string) string {
	gutenbergID = strings.TrimSpace(gutenbergID)
	if gutenbergID == "" || !strings.Contains(html, "images/") {
		return html
	}

	base := fmt.Sprintf("https://www.gutenberg.org/files/%s/%s-h/", gutenbergID, gutenbergID)
	return gutenbergRelativeMediaRe.ReplaceAllStringFunc(html, func(match string) string {
		parts := gutenbergRelativeMediaRe.FindStringSubmatch(match)
		if len(parts) != 3 {
			return match
		}
		return fmt.Sprintf(`%s="%s%s"`, parts[1], base, parts[2])
	})
}
