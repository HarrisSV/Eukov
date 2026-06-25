package service

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/google/uuid"
)

const (
	docxExtension   = ".docx"
	readerExtension = ".reader.html"
	legacyExtension = ".txt"
)

type DocumentFileService struct {
	basePath string
	locks    sync.Map
}

func NewDocumentFileService(basePath string) *DocumentFileService {
	return &DocumentFileService{basePath: basePath}
}

func (s *DocumentFileService) authorDir(authorID uuid.UUID) (string, error) {
	dir := filepath.Join(s.basePath, "dockets", authorID.String())
	clean := filepath.Clean(dir)
	base := filepath.Clean(filepath.Join(s.basePath, "dockets"))
	if !filepath.HasPrefix(clean, base) {
		return "", fmt.Errorf("invalid document path")
	}
	return clean, nil
}

func (s *DocumentFileService) docxPath(authorID, documentID uuid.UUID) (string, error) {
	dir, err := s.authorDir(authorID)
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, documentID.String()+docxExtension), nil
}

func (s *DocumentFileService) readerPath(authorID, documentID uuid.UUID) (string, error) {
	dir, err := s.authorDir(authorID)
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, documentID.String()+readerExtension), nil
}

func (s *DocumentFileService) legacyPath(authorID, documentID uuid.UUID) (string, error) {
	dir, err := s.authorDir(authorID)
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, documentID.String()+legacyExtension), nil
}

// DocumentPath returns the canonical .docx path stored on the document record.
func (s *DocumentFileService) DocumentPath(authorID, documentID uuid.UUID) (string, error) {
	return s.docxPath(authorID, documentID)
}

func (s *DocumentFileService) HasDocx(authorID, documentID uuid.UUID) bool {
	path, err := s.docxPath(authorID, documentID)
	if err != nil {
		return false
	}
	_, err = os.Stat(path)
	return err == nil
}

func (s *DocumentFileService) WriteDocx(authorID, documentID uuid.UUID, data []byte) error {
	path, err := s.docxPath(authorID, documentID)
	if err != nil {
		return err
	}
	return s.writeBytes(documentID, path, data)
}

func (s *DocumentFileService) ReadDocx(authorID, documentID uuid.UUID) ([]byte, error) {
	path, err := s.docxPath(authorID, documentID)
	if err != nil {
		return nil, err
	}
	return s.readBytes(documentID, path)
}

func (s *DocumentFileService) WriteReaderHTML(authorID, documentID uuid.UUID, html string) error {
	path, err := s.readerPath(authorID, documentID)
	if err != nil {
		return err
	}
	return s.writeBytes(documentID, path, []byte(html))
}

func (s *DocumentFileService) ReadReaderHTML(authorID, documentID uuid.UUID) (string, error) {
	path, err := s.readerPath(authorID, documentID)
	if err != nil {
		return "", err
	}
	data, err := s.readBytes(documentID, path)
	if err != nil {
		return "", err
	}
	if len(data) == 0 {
		return "", nil
	}
	return string(data), nil
}

// ReadContent returns reader HTML when available, otherwise legacy TipTap HTML.
func (s *DocumentFileService) ReadContent(authorID, documentID uuid.UUID) (string, error) {
	readerHTML, err := s.ReadReaderHTML(authorID, documentID)
	if err != nil {
		return "", err
	}
	if readerHTML != "" {
		return readerHTML, nil
	}

	path, err := s.legacyPath(authorID, documentID)
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

// WriteContent stores legacy TipTap HTML (pre-docx drafts).
func (s *DocumentFileService) WriteContent(authorID, documentID uuid.UUID, content string) error {
	path, err := s.legacyPath(authorID, documentID)
	if err != nil {
		return err
	}
	return s.writeBytes(documentID, path, []byte(content))
}

func (s *DocumentFileService) DeleteContent(authorID, documentID uuid.UUID) error {
	lock := s.lockFor(documentID)
	lock.Lock()
	defer lock.Unlock()

	for _, pathFn := range []func(uuid.UUID, uuid.UUID) (string, error){
		s.docxPath,
		s.readerPath,
		s.legacyPath,
	} {
		path, err := pathFn(authorID, documentID)
		if err != nil {
			return err
		}
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	return nil
}

func DecodeDocxBase64(encoded string) ([]byte, error) {
	if encoded == "" {
		return nil, nil
	}
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("invalid docx content encoding: %w", err)
	}
	return data, nil
}

func (s *DocumentFileService) ReadAuthorDraft(authorID, documentID uuid.UUID) (content string, format string, err error) {
	if s.HasDocx(authorID, documentID) {
		data, err := s.ReadDocx(authorID, documentID)
		if err != nil {
			return "", "", err
		}
		if len(data) > 0 {
			return EncodeDocxBase64(data), "docx", nil
		}
	}

	path, err := s.legacyPath(authorID, documentID)
	if err != nil {
		return "", "", err
	}
	data, err := s.readBytes(documentID, path)
	if err != nil {
		return "", "", err
	}
	if len(data) == 0 {
		return "", "html", nil
	}
	return string(data), "html", nil
}

func EncodeDocxBase64(data []byte) string {
	if len(data) == 0 {
		return ""
	}
	return base64.StdEncoding.EncodeToString(data)
}

func (s *DocumentFileService) writeBytes(documentID uuid.UUID, path string, data []byte) error {
	lock := s.lockFor(documentID)
	lock.Lock()
	defer lock.Unlock()

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create document directory: %w", err)
	}

	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return fmt.Errorf("write temp file: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("atomic rename: %w", err)
	}
	return nil
}

func (s *DocumentFileService) readBytes(documentID uuid.UUID, path string) ([]byte, error) {
	lock := s.lockFor(documentID)
	lock.RLock()
	defer lock.RUnlock()

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	return data, nil
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
