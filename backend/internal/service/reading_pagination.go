package service

import (
	"regexp"
	"strings"
)

// EditorWordsPerPage matches frontend paginate-html WORDS_PER_PAGE.
const EditorWordsPerPage = 334

var (
	pageBreakBlockRe = regexp.MustCompile(`(?is)<div[^>]*data-type="page-break"[^>]*>.*?</div>`)
	sectionBreakRe   = regexp.MustCompile(`(?is)<div[^>]*data-type="section-break"[^>]*>.*?</div>`)
	htmlTagReExtract = regexp.MustCompile(`(?is)<[^>]+>`)
)

// PaginateReadingContent splits document content into reader pages aligned with the editor.
func PaginateReadingContent(content string) []string {
	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		return []string{""}
	}

	if IsLikelyHTML(trimmed) && strings.Contains(trimmed, `data-type="page-sheet"`) {
		if pages := extractPageSheetPages(trimmed); len(pages) > 0 {
			return pages
		}
	}

	cleaned := stripEditorChromeHTML(trimmed)
	if IsLikelyHTML(cleaned) {
		if pages := paginateHTMLLikeEditor(cleaned, EditorWordsPerPage); len(pages) > 0 {
			return pages
		}
	}

	return paginatePlainByWords(StripHTML(cleaned), EditorWordsPerPage)
}

func stripEditorChromeHTML(html string) string {
	html = pageBreakBlockRe.ReplaceAllString(html, "")
	html = sectionBreakRe.ReplaceAllString(html, "")
	return html
}

// extractPageSheetPages returns one reader page per editor page-sheet, in document order.
func extractPageSheetPages(html string) []string {
	var pages []string
	searchFrom := 0
	marker := `data-type="page-sheet"`

	for {
		rel := strings.Index(html[searchFrom:], marker)
		if rel < 0 {
			break
		}
		markerIdx := searchFrom + rel
		openStart := strings.LastIndex(html[searchFrom:markerIdx], "<div")
		if openStart < 0 {
			break
		}
		openStart += searchFrom

		inner, nextIdx := extractDivInnerHTML(html, openStart)
		if nextIdx < 0 {
			break
		}

		inner = stripEditorChromeHTML(inner)
		if strings.TrimSpace(StripHTML(inner)) == "" {
			searchFrom = nextIdx
			continue
		}
		pages = append(pages, strings.TrimSpace(inner))
		searchFrom = nextIdx
	}

	return pages
}

func extractDivInnerHTML(html string, openStart int) (inner string, nextIndex int) {
	if openStart < 0 || openStart >= len(html) || !strings.HasPrefix(html[openStart:], "<div") {
		return "", -1
	}

	closeTag := strings.Index(html[openStart:], ">")
	if closeTag < 0 {
		return "", -1
	}
	contentStart := openStart + closeTag + 1

	depth := 0
	i := openStart
	for i < len(html) {
		switch {
		case strings.HasPrefix(html[i:], "<div"):
			depth++
			i += 4
		case strings.HasPrefix(html[i:], "</div>"):
			depth--
			if depth == 0 {
				end := i + len("</div>")
				return html[contentStart:i], end
			}
			i += len("</div>")
		default:
			i++
		}
	}
	return "", -1
}

func paginateHTMLLikeEditor(html string, wordsPerPage int) []string {
	normalized := normalizeHTMLForPagination(html)
	if normalized == "" {
		return nil
	}

	blocks := splitTopLevelHTMLBlocks(normalized)
	if len(blocks) == 0 {
		return nil
	}

	type pageBlocks struct {
		blocks []string
	}
	pages := []pageBlocks{{}}
	wordsOnPage := 0

	for _, block := range blocks {
		if isPageBreakBlock(block) {
			continue
		}
		for _, chunk := range splitBlockByWordLimitHTML(block, wordsPerPage) {
			wordCount := countWords(stripHTMLTags(chunk))
			if wordsOnPage > 0 && wordsOnPage+wordCount > wordsPerPage {
				pages = append(pages, pageBlocks{})
				wordsOnPage = 0
			}
			last := &pages[len(pages)-1]
			last.blocks = append(last.blocks, chunk)
			wordsOnPage += wordCount
		}
	}

	out := make([]string, 0, len(pages))
	for _, page := range pages {
		combined := strings.TrimSpace(strings.Join(page.blocks, ""))
		if strings.TrimSpace(StripHTML(combined)) == "" {
			continue
		}
		out = append(out, combined)
	}
	return out
}

func normalizeHTMLForPagination(html string) string {
	cleaned := stripEditorChromeHTML(html)

	var blocks []string
	searchFrom := 0
	for {
		rel := strings.Index(cleaned[searchFrom:], `data-type="page-sheet"`)
		if rel < 0 {
			break
		}
		markerIdx := searchFrom + rel
		openStart := strings.LastIndex(cleaned[searchFrom:markerIdx], "<div")
		if openStart < 0 {
			break
		}
		openStart += searchFrom
		inner, nextIdx := extractDivInnerHTML(cleaned, openStart)
		if nextIdx < 0 {
			break
		}
		blocks = append(blocks, splitTopLevelHTMLBlocks(stripEditorChromeHTML(inner))...)
		searchFrom = nextIdx
	}

	if len(blocks) > 0 {
		return strings.Join(blocks, "")
	}
	return cleaned
}

func splitTopLevelHTMLBlocks(html string) []string {
	var blocks []string
	i := 0
	for i < len(html) {
		for i < len(html) && html[i] == ' ' {
			i++
		}
		if i >= len(html) {
			break
		}
		if html[i] != '<' {
			end := strings.IndexByte(html[i:], '<')
			if end < 0 {
				blocks = append(blocks, html[i:])
				break
			}
			blocks = append(blocks, html[i:i+end])
			i += end
			continue
		}
		if !strings.HasPrefix(html[i:], "<div") {
			end := strings.IndexByte(html[i+1:], '<')
			if end < 0 {
				blocks = append(blocks, html[i:])
				break
			}
			blocks = append(blocks, html[i:i+1+end])
			i = i + 1 + end
			continue
		}
		_, nextIdx := extractDivInnerHTML(html, i)
		if nextIdx < 0 {
			blocks = append(blocks, html[i:])
			break
		}
		blocks = append(blocks, html[i:nextIdx])
		i = nextIdx
	}
	return blocks
}

func isPageBreakBlock(block string) bool {
	return strings.Contains(block, `data-type="page-break"`) ||
		strings.Contains(block, `data-type="section-break"`)
}

func splitBlockByWordLimitHTML(blockHTML string, maxWords int) []string {
	words := strings.Fields(stripHTMLTags(blockHTML))
	if len(words) <= maxWords {
		return []string{blockHTML}
	}
	chunks := make([]string, 0, (len(words)/maxWords)+1)
	for i := 0; i < len(words); i += maxWords {
		end := i + maxWords
		if end > len(words) {
			end = len(words)
		}
		chunks = append(chunks, "<p>"+htmlEscapeWords(words[i:end])+"</p>")
	}
	return chunks
}

func stripHTMLTags(html string) string {
	text := htmlTagReExtract.ReplaceAllString(html, " ")
	return strings.TrimSpace(wsCollapseRe.ReplaceAllString(text, " "))
}

func countWords(text string) int {
	return len(strings.Fields(strings.TrimSpace(text)))
}

func htmlEscapeWords(words []string) string {
	escaped := make([]string, len(words))
	for i, word := range words {
		escaped[i] = htmlEscapeString(word)
	}
	return strings.Join(escaped, " ")
}

func htmlEscapeString(value string) string {
	replacer := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
		`"`, "&quot;",
	)
	return replacer.Replace(value)
}

func paginatePlainByWords(plain string, wordsPerPage int) []string {
	if wordsPerPage <= 0 {
		wordsPerPage = EditorWordsPerPage
	}
	fields := strings.Fields(strings.TrimSpace(plain))
	if len(fields) == 0 {
		return []string{""}
	}
	pages := make([]string, 0, (len(fields)/wordsPerPage)+1)
	for i := 0; i < len(fields); i += wordsPerPage {
		end := i + wordsPerPage
		if end > len(fields) {
			end = len(fields)
		}
		pages = append(pages, "<p>"+htmlEscapeWords(fields[i:end])+"</p>")
	}
	return pages
}

// TotalReadingPages returns the number of reader pages for stored content.
func TotalReadingPages(content string) int {
	return len(PaginateReadingContent(content))
}

// PageAtReading returns one reader page and the total page count.
func PageAtReading(content string, page int) (string, int, error) {
	pages := PaginateReadingContent(content)
	total := len(pages)
	if page < 1 || page > total {
		return "", total, ErrInvalidPage
	}
	return pages[page-1], total, nil
}
