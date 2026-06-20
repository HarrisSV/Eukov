package service

import (
	"strings"
	"testing"
)

func words(n int) string {
	parts := make([]string, n)
	for i := range parts {
		parts[i] = "word"
	}
	return strings.Join(parts, " ")
}

func editorSheetsHTML(pageWordCounts ...int) string {
	var b strings.Builder
	for i, count := range pageWordCounts {
		if i > 0 {
			b.WriteString(`<div data-type="page-break" class="editor-page-break"><span>break</span></div>`)
		}
		b.WriteString(`<div data-type="page-sheet" class="draft-page-sheet"><p>`)
		b.WriteString(words(count))
		b.WriteString(`</p></div>`)
	}
	return b.String()
}

func TestPaginateReadingContentUsesPageSheets(t *testing.T) {
	html := editorSheetsHTML(333, 333, 334)
	pages := PaginateReadingContent(html)
	if len(pages) != 3 {
		t.Fatalf("expected 3 pages from 3 sheets, got %d", len(pages))
	}
	if countWords(pages[0]) != 333 {
		t.Fatalf("page 1 words = %d", countWords(pages[0]))
	}
	if countWords(pages[2]) != 334 {
		t.Fatalf("page 3 words = %d", countWords(pages[2]))
	}
}

func TestPaginateReadingContentBlockAwareFallback(t *testing.T) {
	html := "<p>" + words(333) + "</p><p>" + words(333) + "</p><p>" + words(334) + "</p>"
	pages := PaginateReadingContent(html)
	if len(pages) != 3 {
		t.Fatalf("expected 3 block-aware pages, got %d", len(pages))
	}
}

func TestPaginateReadingContent1000Words(t *testing.T) {
	html := "<p>" + words(1000) + "</p>"
	pages := PaginateReadingContent(html)
	if len(pages) != 3 {
		t.Fatalf("expected 3 pages for 1000 words, got %d", len(pages))
	}
}

func TestPaginateReadingContentByWords(t *testing.T) {
	plain := words(650)
	pages := PaginateReadingContent("<p>" + plain + "</p>")
	if len(pages) != 2 {
		t.Fatalf("expected 2 pages for 650 words, got %d", len(pages))
	}
}

func TestPaginateReadingContentStripsBreakLabelsInsideSheet(t *testing.T) {
	html := `<div data-type="page-sheet" class="draft-page-sheet"><p>hello</p>` +
		`<div data-type="page-break"><span>—— Page Break ——</span></div><p>world</p></div>`
	pages := PaginateReadingContent(html)
	if len(pages) != 1 {
		t.Fatalf("expected 1 page, got %d", len(pages))
	}
	if strings.Contains(pages[0], "Page Break") {
		t.Fatalf("page break label leaked: %q", pages[0])
	}
	if !strings.Contains(pages[0], "hello") || !strings.Contains(pages[0], "world") {
		t.Fatalf("unexpected content: %q", pages[0])
	}
}

func TestPageAtReading(t *testing.T) {
	content := words(350)
	text, total, err := PageAtReading("<p>"+content+"</p>", 2)
	if err != nil {
		t.Fatalf("page at: %v", err)
	}
	if total != 2 {
		t.Fatalf("total = %d", total)
	}
	if countWords(text) != 16 {
		t.Fatalf("page 2 words = %d", countWords(text))
	}
}

func TestTotalReadingPagesEmpty(t *testing.T) {
	if TotalReadingPages("") != 1 {
		t.Fatal("empty content should be one page")
	}
}
