package service

import (
	"strings"
	"testing"
)

func TestDerivePageCoverURL(t *testing.T) {
	t.Parallel()

	html := `<div data-type="page-sheet"><h1>Cover</h1><p>Author name</p></div>` +
		`<div data-type="page-break"></div>` +
		`<div data-type="page-sheet"><p>Body</p></div>`

	cover := DerivePageCoverURL(html)
	if cover == "" {
		t.Fatal("expected cover url")
	}
	if !strings.HasPrefix(cover, PageCoverPrefix) {
		t.Fatalf("expected page cover prefix, got %q", cover)
	}
	if strings.Contains(cover, "Body") {
		t.Fatalf("cover should only include first page")
	}
}

func TestResolvePublishCoverURLPrefersRequested(t *testing.T) {
	t.Parallel()

	requested := "https://example.com/cover.jpg"
	got := ResolvePublishCoverURL("<p>ignored</p>", requested)
	if got != requested {
		t.Fatalf("expected requested cover, got %q", got)
	}
}

func TestResolvePublishCoverURLDerivesWhenMissing(t *testing.T) {
	t.Parallel()

	got := ResolvePublishCoverURL(`<div data-type="page-sheet"><p>Page one</p></div>`, "")
	if got == "" || !strings.HasPrefix(got, PageCoverPrefix) {
		t.Fatalf("expected derived cover, got %q", got)
	}
}
