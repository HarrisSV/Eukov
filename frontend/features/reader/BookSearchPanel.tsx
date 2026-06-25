"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReaderSpreadMode } from "@/features/reader/page-content";
import { leftPageForTarget, viewEndPage } from "@/features/reader/page-content";
import {
  buildBookWordIndex,
  clearSearchHighlightsOnPages,
  getUniquePagesWithMatches,
  resolveSearchNavigationPage,
  scheduleSearchHighlights,
  searchBookPages,
  suggestBookWords,
} from "@/lib/book-search";

const SUGGESTION_PREVIEW = 3;

interface BookSearchPanelProps {
  pages: Array<{ pageNumber: number; content: string }>;
  spreadMode: ReaderSpreadMode;
  totalPages: number;
  currentPage: number;
  navLocked: boolean;
  onNavigate: (leftPage: number) => void;
}

function SearchIcon() {
  return (
    <svg
      aria-hidden
      className="reader-search__icon"
      width="12"
      height="12"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden
      className="reader-search__chevron"
      width="12"
      height="12"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function BookSearchPanel({
  pages,
  spreadMode,
  totalPages,
  currentPage,
  navLocked,
  onNavigate,
}: BookSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [matchingPages, setMatchingPages] = useState<number[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const suggestionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const wordIndex = useMemo(() => buildBookWordIndex(pages), [pages]);
  const suggestions = useMemo(() => suggestBookWords(wordIndex, query), [query, wordIndex]);
  const hasMoreSuggestions = suggestions.length > SUGGESTION_PREVIEW;
  const visibleSuggestions = expanded ? suggestions : suggestions.slice(0, SUGGESTION_PREVIEW);

  useEffect(() => {
    setExpanded(false);
    setHighlightIndex(-1);
  }, [query]);

  useEffect(() => {
    setHighlightIndex(-1);
  }, [expanded]);

  useEffect(() => {
    if (highlightIndex < 0) {
      return;
    }
    suggestionRefs.current[highlightIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, visibleSuggestions]);

  useEffect(() => {
    if (!activeQuery || navLocked) {
      return;
    }

    return scheduleSearchHighlights(matchingPages, activeQuery);
  }, [activeQuery, currentPage, matchingPages, navLocked]);

  useEffect(() => {
    return () => {
      if (matchingPages.length > 0) {
        clearSearchHighlightsOnPages(matchingPages);
      }
    };
  }, [matchingPages]);

  const goToPage = useCallback(
    (pageNumber: number) => {
      onNavigate(leftPageForTarget(pageNumber, totalPages, spreadMode));
    },
    [onNavigate, spreadMode, totalPages],
  );

  const runSearch = useCallback(
    (term: string) => {
      const trimmed = term.trim();

      if (matchingPages.length > 0 && activeQuery) {
        clearSearchHighlightsOnPages(matchingPages);
      }

      if (trimmed.length < 2) {
        setActiveQuery("");
        setMatchingPages([]);
        setStatusMessage(trimmed.length > 0 ? "Type at least 2 characters" : null);
        return;
      }

      const matches = searchBookPages(pages, trimmed);
      const pageNumbers = getUniquePagesWithMatches(matches);

      if (pageNumbers.length === 0) {
        setActiveQuery("");
        setMatchingPages([]);
        setStatusMessage("No matches");
        return;
      }

      const targetPage = resolveSearchNavigationPage(pageNumbers, totalPages, spreadMode);
      if (!targetPage) {
        return;
      }

      setActiveQuery(trimmed);
      setMatchingPages(pageNumbers);
      setStatusMessage(null);
      onNavigate(targetPage);
      setOpen(false);
    },
    [activeQuery, matchingPages, onNavigate, pages, spreadMode, totalPages],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runSearch(query);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const showList = open && query.trim().length > 0 && suggestions.length > 0;

    if (event.key === "Enter") {
      event.preventDefault();
      if (showList && highlightIndex >= 0 && visibleSuggestions[highlightIndex]) {
        selectSuggestion(visibleSuggestions[highlightIndex]);
      } else {
        runSearch(query);
      }
      return;
    }

    if (!showList) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((prev) => {
        if (visibleSuggestions.length === 0) return -1;
        return prev < visibleSuggestions.length - 1 ? prev + 1 : 0;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((prev) => {
        if (visibleSuggestions.length === 0) return -1;
        return prev <= 0 ? visibleSuggestions.length - 1 : prev - 1;
      });
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setHighlightIndex(-1);
    }
  };

  const selectSuggestion = (word: string) => {
    setQuery(word);
    setHighlightIndex(-1);
    runSearch(word);
  };

  const showSuggestions = open && query.trim().length > 0 && suggestions.length > 0;
  const viewEnd = viewEndPage(currentPage, totalPages, spreadMode);

  return (
    <section className="reader-search" aria-label="Search in book">
      <div className="reader-search__row">
        <form className="reader-search__form" onSubmit={handleSubmit}>
          <div className="reader-search__input-wrap">
            <SearchIcon />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                const next = event.target.value;
                setQuery(next);
                setOpen(true);
                const trimmed = next.trim();
                if (!trimmed || trimmed.length < 2) {
                  if (matchingPages.length > 0 && activeQuery) {
                    clearSearchHighlightsOnPages(matchingPages);
                  }
                  setActiveQuery("");
                  setMatchingPages([]);
                  setStatusMessage(trimmed.length > 0 ? "Type at least 2 characters" : null);
                  if (!trimmed) {
                    setOpen(false);
                  }
                }
              }}
              onFocus={() => {
                if (query.trim()) {
                  setOpen(true);
                }
              }}
              onKeyDown={handleInputKeyDown}
              onBlur={() => {
                window.setTimeout(() => setOpen(false), 150);
              }}
              placeholder="Find a word…"
              className="reader-search__input"
              role="combobox"
              aria-expanded={showSuggestions}
              aria-autocomplete="list"
              aria-controls="reader-search-suggestions"
              aria-activedescendant={
                showSuggestions && highlightIndex >= 0
                  ? `reader-search-option-${highlightIndex}`
                  : undefined
              }
            />
          </div>

          {showSuggestions ? (
            <div id="reader-search-suggestions" className="reader-search__suggestions" role="listbox">
              <ul className="reader-search__suggestion-list">
                {visibleSuggestions.map((word, index) => (
                  <li key={word}>
                    <button
                      ref={(element) => {
                        suggestionRefs.current[index] = element;
                      }}
                      type="button"
                      id={`reader-search-option-${index}`}
                      role="option"
                      aria-selected={highlightIndex === index}
                      className={`reader-search__suggestion${
                        highlightIndex === index ? " reader-search__suggestion--active" : ""
                      }`}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setHighlightIndex(index)}
                      onClick={() => selectSuggestion(word)}
                    >
                      {word}
                    </button>
                  </li>
                ))}
              </ul>
              {hasMoreSuggestions ? (
                <button
                  type="button"
                  className="reader-search__expand"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setExpanded((value) => !value)}
                  aria-expanded={expanded}
                >
                  <ChevronDownIcon />
                  <span>{expanded ? "Show less" : `Show all ${suggestions.length} words`}</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </form>

        {matchingPages.length > 0 ? (
          <p className="reader-search__status">
            Found on {matchingPages.length === 1 ? "page" : "pages"}{" "}
            {matchingPages.map((pageNumber, index) => {
              const isCurrentView = pageNumber >= currentPage && pageNumber <= viewEnd;
              return (
                <span key={pageNumber}>
                  {index > 0 ? ", " : null}
                  <button
                    type="button"
                    className={`reader-search__page-link${
                      isCurrentView ? " reader-search__page-link--current" : ""
                    }`}
                    onClick={() => goToPage(pageNumber)}
                    aria-current={isCurrentView ? "page" : undefined}
                  >
                    {pageNumber}
                  </button>
                </span>
              );
            })}
          </p>
        ) : statusMessage ? (
          <p className="reader-search__status">{statusMessage}</p>
        ) : null}
      </div>
    </section>
  );
}
