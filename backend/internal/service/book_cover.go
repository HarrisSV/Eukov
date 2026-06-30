package service

import (
	"encoding/base64"
	"strings"
)

const PageCoverPrefix = "eukov:page-cover;base64,"

func DerivePageCoverURL(readerHTML string) string {
	pages := PaginateReadingContent(readerHTML)
	if len(pages) == 0 {
		return ""
	}

	firstPage := strings.TrimSpace(pages[0])
	if firstPage == "" || strings.TrimSpace(StripHTML(firstPage)) == "" {
		return ""
	}

	encoded := base64.StdEncoding.EncodeToString([]byte(firstPage))
	return PageCoverPrefix + encoded
}

func ResolvePublishCoverURL(readerHTML, requestedCoverURL string) string {
	if cover := strings.TrimSpace(requestedCoverURL); cover != "" {
		return cover
	}
	return DerivePageCoverURL(readerHTML)
}
