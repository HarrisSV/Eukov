package service

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/eukov/backend/internal/ai"
	"github.com/eukov/backend/internal/repository"
	"github.com/google/uuid"
)

const (
	proofreadMaxInputChars   = 12000
	summaryMaxInputChars     = 14000
	fullSummaryChunkChars    = 12000
	fullSummaryCacheTTL      = 6 * time.Hour
	summaryCacheTTL          = 6 * time.Hour
)

var (
	imgTagRe    = regexp.MustCompile(`(?is)<img[^>]*>`)
	altAttrRe   = regexp.MustCompile(`(?is)alt\s*=\s*["']([^"']*)["']`)
	titleAttrRe = regexp.MustCompile(`(?is)title\s*=\s*["']([^"']*)["']`)
	srcAttrRe   = regexp.MustCompile(`(?is)src\s*=\s*["']([^"']*)["']`)
)

type AIService struct {
	qwen      *ai.QwenClient
	documents *repository.DocumentRepository
	files     *DocumentFileService
}

func NewAIService(qwen *ai.QwenClient, documents *repository.DocumentRepository, files *DocumentFileService) *AIService {
	return &AIService{
		qwen:      qwen,
		documents: documents,
		files:     files,
	}
}

func (s *AIService) Enabled() bool {
	return s != nil && s.qwen != nil && s.qwen.Enabled()
}

type ProofreadResult struct {
	CorrectedText string `json:"correctedText"`
	CorrectedHTML string `json:"correctedHtml"`
	UsedAI        bool   `json:"usedAi"`
}

func (s *AIService) Proofread(ctx context.Context, text string) (*ProofreadResult, error) {
	plain := strings.TrimSpace(StripHTML(text))
	if plain == "" {
		return nil, fmt.Errorf("no text to proofread")
	}
	if len(plain) > proofreadMaxInputChars {
		plain = plain[:proofreadMaxInputChars]
	}

	if !s.Enabled() {
		return &ProofreadResult{
			CorrectedText: plain,
			CorrectedHTML: paragraphsToHTML(plain),
			UsedAI:        false,
		}, nil
	}

	system := "You are a professional copy editor. Fix grammar, spelling, and punctuation. Improve clarity with light rephrasing while preserving meaning and voice. Return only the corrected manuscript text with blank lines between paragraphs. Do not add commentary."
	user := fmt.Sprintf("Proofread and lightly rephrase this manuscript excerpt:\n\n%s", plain)

	corrected, err := s.qwen.Complete(ctx, system, user, 2048)
	if err != nil {
		return nil, err
	}
	corrected = sanitizeModelOutput(corrected)
	if corrected == "" {
		corrected = plain
	}

	return &ProofreadResult{
		CorrectedText: corrected,
		CorrectedHTML: paragraphsToHTML(corrected),
		UsedAI:        true,
	}, nil
}

type BookSummaryResult struct {
	DocumentID uuid.UUID `json:"documentId"`
	Title      string    `json:"title"`
	Summary    string    `json:"summary"`
	UsedAI     bool      `json:"usedAi"`
	WordCount  int       `json:"wordCount,omitempty"`
	ImageCount int       `json:"imageCount,omitempty"`
}

type summaryCacheEntry struct {
	summary   string
	expiresAt time.Time
}

var (
	summaryCache     = make(map[uuid.UUID]summaryCacheEntry)
	fullSummaryCache = make(map[uuid.UUID]fullSummaryCacheEntry)
	summaryCacheMu   sync.RWMutex
)

func (s *AIService) SummarizeBook(ctx context.Context, documentID uuid.UUID) (*BookSummaryResult, error) {
	if cached, ok := readSummaryCache(documentID); ok {
		doc, err := s.documents.FindByID(ctx, documentID)
		if err != nil {
			return nil, err
		}
		return &BookSummaryResult{
			DocumentID: documentID,
			Title:      doc.Title,
			Summary:    cached,
			UsedAI:     s.Enabled(),
		}, nil
	}

	doc, err := s.documents.FindByID(ctx, documentID)
	if err != nil {
		return nil, err
	}

	authorID := doc.AuthorID
	if authorID == uuid.Nil {
		authorID, err = s.documents.AuthorIDForDocument(ctx, documentID)
		if err != nil {
			return nil, err
		}
	}

	content, err := s.files.ReadContent(authorID, documentID)
	if err != nil {
		return nil, err
	}
	plain := StripHTML(content)
	if plain == "" {
		return &BookSummaryResult{
			DocumentID: documentID,
			Title:      doc.Title,
			Summary:    "No readable content is available for this title yet.",
			UsedAI:     false,
		}, nil
	}
	if len(plain) > summaryMaxInputChars {
		plain = plain[:summaryMaxInputChars]
	}

	summary := buildFallbackSummary(doc.Title, plain)
	usedAI := false

	if s.Enabled() {
		system := "You are a literary assistant. Write a concise single-page summary of the book for a reader deciding whether to open it. Cover the main themes, tone, audience, and narrative arc without spoilers beyond the opening act. Use 2-4 short paragraphs in plain English."
		user := fmt.Sprintf("Title: %s\n\nManuscript excerpt:\n%s", doc.Title, plain)
		if aiSummary, err := s.qwen.Complete(ctx, system, user, 900); err == nil {
			clean := sanitizeModelOutput(aiSummary)
			if clean != "" {
				summary = clean
				usedAI = true
			}
		}
	}

	writeSummaryCache(documentID, summary)

	return &BookSummaryResult{
		DocumentID: documentID,
		Title:      doc.Title,
		Summary:    summary,
		UsedAI:     usedAI,
	}, nil
}

// SummarizeFullBook scans the entire manuscript (text + image descriptions) and returns a long-form summary.
func (s *AIService) SummarizeFullBook(ctx context.Context, documentID uuid.UUID) (*BookSummaryResult, error) {
	if cached, ok := readFullSummaryCache(documentID); ok {
		doc, err := s.documents.FindByID(ctx, documentID)
		if err != nil {
			return nil, err
		}
		return &BookSummaryResult{
			DocumentID: documentID,
			Title:      doc.Title,
			Summary:    cached.summary,
			UsedAI:     s.Enabled(),
			WordCount:  cached.wordCount,
			ImageCount: cached.imageCount,
		}, nil
	}

	doc, err := s.documents.FindByID(ctx, documentID)
	if err != nil {
		return nil, err
	}

	authorID := doc.AuthorID
	if authorID == uuid.Nil {
		authorID, err = s.documents.AuthorIDForDocument(ctx, documentID)
		if err != nil {
			return nil, err
		}
	}

	content, err := s.files.ReadContent(authorID, documentID)
	if err != nil {
		return nil, err
	}

	imageCount := countImages(content)
	manuscript := extractManuscriptWithImages(content)
	wordCount := WordCount(manuscript)
	if strings.TrimSpace(manuscript) == "" {
		return &BookSummaryResult{
			DocumentID: documentID,
			Title:      doc.Title,
			Summary:    "No readable content is available for this title yet.",
			UsedAI:     false,
			WordCount:  0,
			ImageCount: imageCount,
		}, nil
	}

	summary := buildFullFallbackSummary(doc.Title, wordCount, imageCount)
	usedAI := false

	if s.Enabled() {
		if aiSummary, err := s.synthesizeFullBookSummary(ctx, doc.Title, manuscript, wordCount, imageCount); err == nil && aiSummary != "" && !looksLikeRawManuscript(aiSummary) {
			summary = aiSummary
			usedAI = true
		}
	}

	writeFullSummaryCache(documentID, summary, wordCount, imageCount)

	return &BookSummaryResult{
		DocumentID: documentID,
		Title:      doc.Title,
		Summary:    summary,
		UsedAI:     usedAI,
		WordCount:  wordCount,
		ImageCount: imageCount,
	}, nil
}

func (s *AIService) synthesizeFullBookSummary(
	ctx context.Context,
	title, manuscript string,
	wordCount, imageCount int,
) (string, error) {
	chunks := splitSummaryChunks(manuscript, fullSummaryChunkChars)
	if len(chunks) == 0 {
		return "", fmt.Errorf("empty manuscript")
	}

	sectionNotes := make([]string, 0, len(chunks))
	if len(chunks) > 1 {
		for i, chunk := range chunks {
			system := "You summarize one section of a full book for later synthesis. Capture themes, events, figures, and any [Image: ...] descriptions. Be thorough but concise."
			user := fmt.Sprintf("Book: %s\nSection %d of %d:\n\n%s", title, i+1, len(chunks), chunk)
			note, err := s.qwen.Complete(ctx, system, user, 700)
			if err != nil {
				return "", err
			}
			note = sanitizeModelOutput(note)
			if note != "" {
				sectionNotes = append(sectionNotes, note)
			}
		}
		manuscript = strings.Join(sectionNotes, "\n\n")
	}

	system := "You are a literary analyst. Write a comprehensive full-page summary of the ENTIRE book for a reader who has not opened it yet. Cover major themes, structure, tone, audience, narrative or argumentative arc, and how illustrations/images support the text. Use 5-8 substantial paragraphs that fill a full reading page. Do not use bullet lists."
	user := fmt.Sprintf(
		"Title: %s\nTotal words scanned: %d\nImages/figures noted: %d\n\nComplete manuscript digest:\n%s",
		title,
		wordCount,
		imageCount,
		manuscript,
	)
	final, err := s.qwen.Complete(ctx, system, user, 2800)
	if err != nil {
		return "", err
	}
	return sanitizeModelOutput(final), nil
}

func extractManuscriptWithImages(html string) string {
	if strings.TrimSpace(html) == "" {
		return ""
	}

	pages := PaginateReadingContent(html)
	var parts []string
	for i, page := range pages {
		pageText := strings.TrimSpace(StripHTML(replaceImagesWithMarkers(page)))
		if pageText == "" {
			continue
		}
		parts = append(parts, fmt.Sprintf("[Page %d]\n%s", i+1, pageText))
	}
	if len(parts) == 0 {
		return strings.TrimSpace(StripHTML(replaceImagesWithMarkers(html)))
	}
	return strings.Join(parts, "\n\n")
}

func replaceImagesWithMarkers(html string) string {
	return imgTagRe.ReplaceAllStringFunc(html, func(tag string) string {
		alt := firstCapture(altAttrRe, tag)
		if alt == "" {
			alt = firstCapture(titleAttrRe, tag)
		}
		if alt == "" {
			src := firstCapture(srcAttrRe, tag)
			if src != "" {
				if idx := strings.LastIndexAny(src, "/\\"); idx >= 0 && idx+1 < len(src) {
					src = src[idx+1:]
				}
				alt = src
			}
		}
		if alt == "" {
			alt = "illustration"
		}
		return fmt.Sprintf(" [Image: %s] ", alt)
	})
}

func firstCapture(re *regexp.Regexp, value string) string {
	match := re.FindStringSubmatch(value)
	if len(match) > 1 {
		return strings.TrimSpace(match[1])
	}
	return ""
}

func countImages(html string) int {
	return len(imgTagRe.FindAllString(html, -1))
}

func splitSummaryChunks(text string, maxChars int) []string {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil
	}
	if len(text) <= maxChars {
		return []string{text}
	}

	paragraphs := strings.Split(text, "\n\n")
	var chunks []string
	var current strings.Builder

	flush := func() {
		if current.Len() == 0 {
			return
		}
		chunks = append(chunks, strings.TrimSpace(current.String()))
		current.Reset()
	}

	for _, paragraph := range paragraphs {
		paragraph = strings.TrimSpace(paragraph)
		if paragraph == "" {
			continue
		}
		extra := paragraph
		if current.Len() > 0 {
			extra = "\n\n" + paragraph
		}
		if current.Len()+len(extra) > maxChars && current.Len() > 0 {
			flush()
			extra = paragraph
		}
		if len(paragraph) > maxChars {
			flush()
			for start := 0; start < len(paragraph); start += maxChars {
				end := start + maxChars
				if end > len(paragraph) {
					end = len(paragraph)
				}
				chunks = append(chunks, paragraph[start:end])
			}
			continue
		}
		current.WriteString(extra)
	}
	flush()
	return chunks
}

func formatIntWithCommas(n int) string {
	s := fmt.Sprintf("%d", n)
	if n < 1000 {
		return s
	}
	// Simple grouping for display
	var parts []string
	for len(s) > 3 {
		parts = append([]string{s[len(s)-3:]}, parts...)
		s = s[:len(s)-3]
	}
	if s != "" {
		parts = append([]string{s}, parts...)
	}
	return strings.Join(parts, ",")
}

func buildFullFallbackSummary(title string, wordCount, imageCount int) string {
	return fmt.Sprintf(
		"%s is a %s-word work with %d images and figures. A full AI summary could not be generated right now — please try again shortly.",
		title,
		formatIntWithCommas(wordCount),
		imageCount,
	)
}

func looksLikeRawManuscript(text string) bool {
	pageMarkers := strings.Count(text, "[Page ")
	return pageMarkers >= 2 || (pageMarkers >= 1 && len(text) > 4000)
}

type fullSummaryCacheEntry struct {
	summary   string
	wordCount int
	imageCount int
	expiresAt time.Time
}

func readFullSummaryCache(documentID uuid.UUID) (fullSummaryCacheEntry, bool) {
	summaryCacheMu.RLock()
	defer summaryCacheMu.RUnlock()
	entry, ok := fullSummaryCache[documentID]
	if !ok || time.Now().After(entry.expiresAt) {
		return fullSummaryCacheEntry{}, false
	}
	return entry, true
}

func writeFullSummaryCache(documentID uuid.UUID, summary string, wordCount, imageCount int) {
	summaryCacheMu.Lock()
	defer summaryCacheMu.Unlock()
	fullSummaryCache[documentID] = fullSummaryCacheEntry{
		summary:    summary,
		wordCount:  wordCount,
		imageCount: imageCount,
		expiresAt:  time.Now().Add(fullSummaryCacheTTL),
	}
}

type ReaderInterestProfile struct {
	GenreNames       []string
	ReadTitles       []string
	InProgressTitles []string
	ActivityTypes    map[string]int
	TagFrequency     map[string]int
}

func (s *AIService) RerankRecommendations(
	ctx context.Context,
	profile ReaderInterestProfile,
	candidates []RecommendedBook,
	limit int,
) ([]RecommendedBook, error) {
	if limit <= 0 {
		limit = 8
	}
	if len(candidates) == 0 {
		return candidates, nil
	}
	if !s.Enabled() || len(candidates) <= limit {
		return candidates[:min(len(candidates), limit)], nil
	}

	type candidateBrief struct {
		ID      string   `json:"id"`
		Title   string   `json:"title"`
		Genre   string   `json:"genre"`
		Tags    []string `json:"tags"`
		Summary string   `json:"summary"`
		Score   int      `json:"score"`
	}

	briefs := make([]candidateBrief, 0, len(candidates))
	byID := make(map[string]RecommendedBook, len(candidates))
	for _, book := range candidates {
		id := book.ID.String()
		briefs = append(briefs, candidateBrief{
			ID:      id,
			Title:   book.Title,
			Genre:   book.GenreName,
			Tags:    book.Tags,
			Summary: truncateRunes(book.Summary, 180),
			Score:   book.Score,
		})
		byID[id] = book
	}

	briefJSON, _ := json.Marshal(briefs)
	system := "You personalize a reading library. Pick the best books for this reader using their genre interests, reading history, and tags. Respond with JSON only: {\"orderedIds\":[\"uuid\",...],\"reasons\":{\"uuid\":\"short reason\"}}."
	user := fmt.Sprintf(
		"Reader profile:\n- Preferred genres: %s\n- Previously opened titles: %s\n- In progress: %s\n- Tag signals: %s\n- Activity counts: %s\n\nCandidate books JSON:\n%s\n\nReturn up to %d book ids in best-match order.",
		strings.Join(profile.GenreNames, ", "),
		strings.Join(profile.ReadTitles, "; "),
		strings.Join(profile.InProgressTitles, "; "),
		formatTagFrequency(profile.TagFrequency),
		formatActivityCounts(profile.ActivityTypes),
		string(briefJSON),
		limit,
	)

	raw, err := s.qwen.Complete(ctx, system, user, 1200)
	if err != nil {
		return candidates[:min(len(candidates), limit)], nil
	}

	var parsed struct {
		OrderedIDs []string          `json:"orderedIds"`
		Reasons    map[string]string `json:"reasons"`
	}
	jsonText := extractJSONObject(raw)
	if jsonText == "" || json.Unmarshal([]byte(jsonText), &parsed) != nil || len(parsed.OrderedIDs) == 0 {
		return candidates[:min(len(candidates), limit)], nil
	}

	seen := make(map[string]struct{}, len(parsed.OrderedIDs))
	out := make([]RecommendedBook, 0, limit)
	for _, id := range parsed.OrderedIDs {
		if len(out) >= limit {
			break
		}
		book, ok := byID[id]
		if !ok {
			continue
		}
		if _, dup := seen[id]; dup {
			continue
		}
		seen[id] = struct{}{}
		if reason := strings.TrimSpace(parsed.Reasons[id]); reason != "" {
			book.Reason = reason
		}
		out = append(out, book)
	}

	for _, book := range candidates {
		if len(out) >= limit {
			break
		}
		id := book.ID.String()
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, book)
	}

	return out, nil
}

func buildFallbackSummary(title, plain string) string {
	words := strings.Fields(plain)
	if len(words) == 0 {
		return fmt.Sprintf("%s does not yet have readable content.", title)
	}
	excerpt := strings.Join(words[:min(len(words), 120)], " ")
	return fmt.Sprintf("%s — %s…", title, excerpt)
}

func paragraphsToHTML(text string) string {
	parts := strings.Split(text, "\n\n")
	var blocks []string
	for _, part := range parts {
		line := strings.TrimSpace(part)
		if line == "" {
			continue
		}
		line = strings.ReplaceAll(line, "\n", " ")
		blocks = append(blocks, "<p>"+htmlEscapeString(line)+"</p>")
	}
	if len(blocks) == 0 {
		return "<p>" + htmlEscapeString(strings.TrimSpace(text)) + "</p>"
	}
	return strings.Join(blocks, "")
}

func sanitizeModelOutput(text string) string {
	text = strings.TrimSpace(text)
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimPrefix(text, "json")
	text = strings.TrimSuffix(text, "```")
	return strings.TrimSpace(text)
}

var jsonObjectRe = regexp.MustCompile(`\{[\s\S]*\}`)

func extractJSONObject(text string) string {
	match := jsonObjectRe.FindString(strings.TrimSpace(text))
	return match
}

func readSummaryCache(documentID uuid.UUID) (string, bool) {
	summaryCacheMu.RLock()
	defer summaryCacheMu.RUnlock()
	entry, ok := summaryCache[documentID]
	if !ok || time.Now().After(entry.expiresAt) {
		return "", false
	}
	return entry.summary, true
}

func writeSummaryCache(documentID uuid.UUID, summary string) {
	summaryCacheMu.Lock()
	defer summaryCacheMu.Unlock()
	summaryCache[documentID] = summaryCacheEntry{
		summary:   summary,
		expiresAt: time.Now().Add(summaryCacheTTL),
	}
}

func formatTagFrequency(tags map[string]int) string {
	if len(tags) == 0 {
		return "none"
	}
	type pair struct {
		tag   string
		count int
	}
	items := make([]pair, 0, len(tags))
	for tag, count := range tags {
		items = append(items, pair{tag: tag, count: count})
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].count == items[j].count {
			return items[i].tag < items[j].tag
		}
		return items[i].count > items[j].count
	})
	parts := make([]string, 0, min(len(items), 12))
	for i, item := range items {
		if i >= 12 {
			break
		}
		parts = append(parts, fmt.Sprintf("%s(%d)", item.tag, item.count))
	}
	return strings.Join(parts, ", ")
}

func formatActivityCounts(counts map[string]int) string {
	if len(counts) == 0 {
		return "none"
	}
	parts := make([]string, 0, len(counts))
	for activity, count := range counts {
		parts = append(parts, fmt.Sprintf("%s:%d", activity, count))
	}
	sort.Strings(parts)
	return strings.Join(parts, ", ")
}

func truncateRunes(value string, max int) string {
	runes := []rune(value)
	if len(runes) <= max {
		return value
	}
	return string(runes[:max]) + "…"
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
