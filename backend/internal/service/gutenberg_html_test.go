package service

import (
	"strings"
	"testing"
)

func TestGutenbergIDFromTags(t *testing.T) {
	id := GutenbergIDFromTags([]string{"public-domain", "gutenberg", "gutenberg-34030", "technology"})
	if id != "34030" {
		t.Fatalf("expected 34030, got %q", id)
	}
	if GutenbergIDFromTags([]string{"gutenberg"}) != "" {
		t.Fatal("expected empty for bare gutenberg tag")
	}
}

func TestRewriteGutenbergMediaURLs(t *testing.T) {
	html := `<div class="figcenter"><img alt="Fig. 39" src="images/051asm.png"></div>`
	got := RewriteGutenbergMediaURLs(html, "34030")
	want := `src="https://www.gutenberg.org/files/34030/34030-h/images/051asm.png"`
	if !strings.Contains(got, want) {
		t.Fatalf("rewrite failed:\n%s", got)
	}
}
