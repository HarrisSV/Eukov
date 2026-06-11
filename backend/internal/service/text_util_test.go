package service

import "testing"

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
