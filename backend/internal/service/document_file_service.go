package service

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/google/uuid"
)

type DocumentFileService struct {
	basePath string
	locks    sync.Map
}

func NewDocumentFileService(basePath string) *DocumentFileService {
	return &DocumentFileService{basePath: basePath}
}

func (s *DocumentFileService) DocumentPath(authorID, documentID uuid.UUID) (string, error) {
	dir := filepath.Join(s.basePath, "dockets", authorID.String())
	full := filepath.Join(dir, documentID.String()+".txt")
	clean := filepath.Clean(full)
	base := filepath.Clean(filepath.Join(s.basePath, "dockets", authorID.String()))
	if !filepath.HasPrefix(clean, base) {
		return "", fmt.Errorf("invalid document path")
	}
	return clean, nil
}

func (s *DocumentFileService) WriteContent(authorID, documentID uuid.UUID, content string) error {
	path, err := s.DocumentPath(authorID, documentID)
	if err != nil {
		return err
	}

	lock := s.lockFor(documentID)
	lock.Lock()
	defer lock.Unlock()

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create document directory: %w", err)
	}

	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, []byte(content), 0o644); err != nil {
		return fmt.Errorf("write temp file: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("atomic rename: %w", err)
	}
	return nil
}

func (s *DocumentFileService) ReadContent(authorID, documentID uuid.UUID) (string, error) {
	path, err := s.DocumentPath(authorID, documentID)
	if err != nil {
		return "", err
	}

	lock := s.lockFor(documentID)
	lock.RLock()
	defer lock.RUnlock()

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}
	return string(data), nil
}

func (s *DocumentFileService) DeleteContent(authorID, documentID uuid.UUID) error {
	path, err := s.DocumentPath(authorID, documentID)
	if err != nil {
		return err
	}

	lock := s.lockFor(documentID)
	lock.Lock()
	defer lock.Unlock()

	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (s *DocumentFileService) lockFor(documentID uuid.UUID) *sync.RWMutex {
	key := documentID.String()
	if existing, ok := s.locks.Load(key); ok {
		return existing.(*sync.RWMutex)
	}
	lock := &sync.RWMutex{}
	actual, _ := s.locks.LoadOrStore(key, lock)
	return actual.(*sync.RWMutex)
}
