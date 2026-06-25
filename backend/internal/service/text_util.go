package service

import (
	"regexp"
	"strings"
)

var htmlTagRe = regexp.MustCompile(`<[^>]*>`)
var wsCollapseRe = regexp.MustCompile(`\s+`)

// StripHTML removes tags and collapses whitespace for plain-text reading.
func StripHTML(html string) string {
	if html == "" {
		return ""
	}
	text := htmlTagRe.ReplaceAllString(html, " ")
	text = strings.ReplaceAll(text, "&nbsp;", " ")
	text = strings.ReplaceAll(text, "&amp;", "&")
	text = strings.ReplaceAll(text, "&lt;", "<")
	text = strings.ReplaceAll(text, "&gt;", ">")
	return strings.TrimSpace(wsCollapseRe.ReplaceAllString(text, " "))
}

// FirstNWords returns the first n words from plain or HTML content.
func FirstNWords(content string, n int) string {
	if n <= 0 {
		return ""
	}
	plain := StripHTML(content)
	fields := strings.Fields(plain)
	if len(fields) <= n {
		return plain
	}
	return strings.Join(fields[:n], " ")
}

// WordCount counts words in plain or HTML content.
func WordCount(content string) int {
	return len(strings.Fields(StripHTML(content)))
}

// IsLikelyHTML reports whether content appears to contain markup.
func IsLikelyHTML(content string) bool {
	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		return false
	}
	if strings.HasPrefix(trimmed, "<") && strings.Contains(trimmed, ">") {
		return true
	}
	// Inline tags (e.g. Gutenberg catalog listings) may not start with "<".
	return htmlTagRe.MatchString(trimmed)
}

// SplitWords is used for preview truncation checks.
func SplitWords(content string) []string {
	return strings.Fields(StripHTML(content))
}
