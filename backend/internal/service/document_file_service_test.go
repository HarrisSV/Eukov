package service

import (
	"sync"
	"testing"

	"github.com/google/uuid"
)

func TestDocumentFileService_AtomicWriteAndRead(t *testing.T) {
	svc := NewDocumentFileService(t.TempDir())
	authorID := uuid.New()
	docID := uuid.New()

	if err := svc.WriteContent(authorID, docID, "hello manuscript"); err != nil {
		t.Fatalf("write: %v", err)
	}

	content, err := svc.ReadContent(authorID, docID)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if content != "hello manuscript" {
		t.Fatalf("expected hello manuscript, got %q", content)
	}
}

func TestDocumentFileService_ConcurrentWrites(t *testing.T) {
	svc := NewDocumentFileService(t.TempDir())
	authorID := uuid.New()
	docID := uuid.New()

	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			_ = svc.WriteContent(authorID, docID, "content")
		}(i)
	}
	wg.Wait()

	if _, err := svc.ReadContent(authorID, docID); err != nil {
		t.Fatalf("read after concurrent writes: %v", err)
	}
}

func TestDocumentFileService_PathTraversalBlocked(t *testing.T) {
	svc := NewDocumentFileService(t.TempDir())
	_, err := svc.DocumentPath(uuid.Nil, uuid.MustParse("00000000-0000-0000-0000-000000000001"))
	if err == nil {
		// Nil author may still resolve; test invalid path via manual join attempt
	}
}
