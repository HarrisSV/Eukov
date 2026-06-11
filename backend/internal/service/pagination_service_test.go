package service

import "testing"

func TestPaginateAndPageAt(t *testing.T) {
	content := "abcdefghijklmnopqrstuvwxyz"
	pages := Paginate(content, 5)
	if len(pages) != 6 {
		t.Fatalf("expected 6 pages, got %d", len(pages))
	}
	text, total, err := PageAt(content, 2, 5)
	if err != nil {
		t.Fatalf("page at: %v", err)
	}
	if total != 6 || text != "fghij" {
		t.Fatalf("unexpected page content %q total %d", text, total)
	}
}

func TestTotalPagesEmptyContent(t *testing.T) {
	if TotalPages("", DefaultPageSize) != 1 {
		t.Fatal("empty content should be one page")
	}
}

func TestCompletionPercentage(t *testing.T) {
	if CompletionPercentage(1, 4) != 25 {
		t.Fatal("expected 25%")
	}
	if CompletionPercentage(4, 4) != 100 {
		t.Fatal("expected 100%")
	}
}

func TestPageAtInvalid(t *testing.T) {
	_, _, err := PageAt("hello", 99, 2)
	if err != ErrInvalidPage {
		t.Fatalf("expected ErrInvalidPage, got %v", err)
	}
}
