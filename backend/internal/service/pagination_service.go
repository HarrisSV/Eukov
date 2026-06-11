package service

import (
	"errors"
	"unicode/utf8"
)

const DefaultPageSize = 3000

var ErrInvalidPage = errors.New("invalid page number")

// Paginate splits content into fixed-size character pages (runes, not bytes).
func Paginate(content string, pageSize int) []string {
	if pageSize <= 0 {
		pageSize = DefaultPageSize
	}
	if content == "" {
		return []string{""}
	}

	runes := []rune(content)
	pages := make([]string, 0, (len(runes)/pageSize)+1)
	for i := 0; i < len(runes); i += pageSize {
		end := i + pageSize
		if end > len(runes) {
			end = len(runes)
		}
		pages = append(pages, string(runes[i:end]))
	}
	return pages
}

func TotalPages(content string, pageSize int) int {
	if pageSize <= 0 {
		pageSize = DefaultPageSize
	}
	length := utf8.RuneCountInString(content)
	if length == 0 {
		return 1
	}
	return (length + pageSize - 1) / pageSize
}

func PageAt(content string, page, pageSize int) (string, int, error) {
	pages := Paginate(content, pageSize)
	total := len(pages)
	if page < 1 || page > total {
		return "", total, ErrInvalidPage
	}
	return pages[page-1], total, nil
}

func CompletionPercentage(page, totalPages int) float64 {
	if totalPages <= 0 {
		return 0
	}
	if page >= totalPages {
		return 100
	}
	return float64(page) / float64(totalPages) * 100
}
