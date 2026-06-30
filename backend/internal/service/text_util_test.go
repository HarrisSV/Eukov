package service

import (
	"strings"
	"testing"
)

func TestStripHTML(t *testing.T) {
	got := StripHTML("<p>Hello <strong>world</strong></p>")
	if got != "Hello world" {
		t.Fatalf("got %q", got)
	}
}

func TestFirstNWords(t *testing.T) {
	content := "<p>one two three four five</p>"
	got := FirstNWords(content, 3)
	if got != "one two three" {
		t.Fatalf("got %q", got)
	}
}

func TestDisplaySummary(t *testing.T) {
	html := `<div data-type="page-sheet" class="draft-page-sheet"><p style="text-align: justify;"><em>Lorem ipsum dolor sit amet.</em></p></div>`
	got := DisplaySummary(html, 280)
	if strings.Contains(got, "<") || strings.Contains(got, "page-sheet") {
		t.Fatalf("expected plain summary, got %q", got)
	}
	if !strings.Contains(got, "Lorem ipsum") {
		t.Fatalf("expected lorem ipsum text, got %q", got)
	}
}
