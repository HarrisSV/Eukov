import { useAuthStore } from "@/store/authStore";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().accessToken;
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = false,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(auth ? getAuthHeaders() : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new NetworkError(
      `Cannot reach API at ${API_BASE}. Is the backend running?`,
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      (data as { error?: string }).error ?? "Request failed",
      response.status,
    );
  }

  return data as T;
}

export interface HealthResponse {
  status: string;
}

export interface RegisterResponse {
  success: boolean;
  userId: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface Genre {
  id: string;
  name: string;
}

export interface GenresResponse {
  genres: Genre[];
}

export interface PreferencesResponse {
  genres: string[];
}

export interface AuthorApplication {
  id: string;
  userId: string;
  qualifications: string;
  experience: string;
  status: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
}

export const api = {
  health: () => request<HealthResponse>("/health"),

  register: (email: string, password: string) =>
    request<RegisterResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  refresh: (refreshToken: string) =>
    request<LoginResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),

  logout: (refreshToken: string) =>
    request<{ success: boolean }>(
      "/auth/logout",
      {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      },
      true,
    ),

  me: () => request<AuthUser>("/auth/me", {}, true),

  getGenres: () => request<GenresResponse>("/genres"),

  savePreferences: (genres: string[]) =>
    request<{ success: boolean }>(
      "/user/preferences",
      {
        method: "POST",
        body: JSON.stringify({ genres }),
      },
      true,
    ),

  getPreferences: (userId: string) =>
    request<PreferencesResponse>(`/user/${userId}/preferences`, {}, true),

  submitAuthorApplication: (qualifications: string, experience: string) =>
    request<{ id: string; status: string }>(
      "/author-applications",
      {
        method: "POST",
        body: JSON.stringify({ qualifications, experience }),
      },
      true,
    ),

  listAuthorApplications: () =>
    request<{ applications: AuthorApplication[] }>(
      "/admin/author-applications",
      {},
      true,
    ),

  approveAuthorApplication: (id: string) =>
    request<{ success: boolean }>(
      `/admin/author-applications/${id}/approve`,
      { method: "POST" },
      true,
    ),

  rejectAuthorApplication: (id: string) =>
    request<{ success: boolean }>(
      `/admin/author-applications/${id}/reject`,
      { method: "POST" },
      true,
    ),

  generateAccessKey: () =>
    request<{ keyId: string; accessKey: string; expiresAt: string }>(
      "/access-keys",
      { method: "POST" },
      true,
    ),

  consumeAccessKey: (accessKey: string) =>
    request<{ success: boolean; role: string }>(
      "/access-keys/consume",
      {
        method: "POST",
        body: JSON.stringify({ accessKey }),
      },
      true,
    ),

  listAuditLogs: () =>
    request<{ logs: AuditLog[] }>("/audit-logs", {}, true),

  listMyDocuments: () =>
    request<{ documents: DocumentSummary[] }>(
      "/documents?mine=true",
      {},
      true,
    ),

  listLibraryDocuments: () =>
    request<{ documents: DocumentSummary[] }>(
      "/library/documents",
      {},
      true,
    ),

  getLibrary: (params?: LibraryQueryParams) => {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.genreId) search.set("genreId", params.genreId);
    if (params?.authorId) search.set("authorId", params.authorId);
    if (params?.sort) search.set("sort", params.sort);
    const qs = search.toString();
    return request<{ books: LibraryBook[] }>(
      `/library${qs ? `?${qs}` : ""}`,
      {},
      true,
    );
  },

  getRecommendedLibrary: (limit = 8) =>
    request<{ books: RecommendedBook[] }>(
      `/library/recommended?limit=${limit}`,
      {},
      true,
    ),

  subscribeAuthor: (authorId: string, documentId?: string) =>
    request<{ subscription: { id: string } }>(
      `/authors/${authorId}/subscribe`,
      {
        method: "POST",
        body: JSON.stringify(documentId ? { documentId } : {}),
      },
      true,
    ),

  getDocumentPreview: (documentId: string) =>
    request<{ preview: BookPreview }>(
      `/documents/${documentId}/preview`,
      {},
      true,
    ),

  unsubscribeAuthor: (authorId: string) =>
    request<{ success: boolean }>(
      `/authors/${authorId}/unsubscribe`,
      { method: "DELETE" },
      true,
    ),

  issueBook: (documentId: string) =>
    request<{ issuedBook: { id: string; documentId: string } }>(
      `/documents/${documentId}/issue`,
      { method: "POST" },
      true,
    ),

  getDocumentPage: (documentId: string, page: number) =>
    request<{ page: DocumentPage }>(
      `/documents/${documentId}/pages/${page}`,
      {},
      true,
    ),

  saveProgress: (documentId: string, page: number) =>
    request<{ progress: ReadingProgress }>(
      "/progress",
      {
        method: "POST",
        body: JSON.stringify({ documentId, page }),
      },
      true,
    ),

  getDocketBooks: () =>
    request<{ books: DocketBook[] }>("/docket/books", {}, true),

  getDocument: (id: string) =>
    request<{ document: DocumentDetail }>(`/documents/${id}`, {}, true),

  createDocument: (title: string, content: string) =>
    request<{ document: DocumentDetail }>(
      "/documents",
      { method: "POST", body: JSON.stringify({ title, content }) },
      true,
    ),

  updateDocument: (id: string, title: string, content: string) =>
    request<{ document: DocumentDetail }>(
      `/documents/${id}`,
      { method: "PUT", body: JSON.stringify({ title, content }) },
      true,
    ),

  deleteDocument: (id: string) =>
    request<{ success: boolean }>(
      `/documents/${id}`,
      { method: "DELETE" },
      true,
    ),

  publishDocument: (
    id: string,
    payload: { genre: string; tags: string[]; title?: string; content?: string },
  ) =>
    request<{ document: DocumentDetail }>(
      `/documents/${id}/publish`,
      { method: "POST", body: JSON.stringify(payload) },
      true,
    ),

  submitUnpublishRequest: (id: string, justification: string) =>
    request<{ success: boolean }>(
      `/documents/${id}/unpublish-request`,
      { method: "POST", body: JSON.stringify({ justification }) },
      true,
    ),

  getDocketWorkspace: () =>
    request<DocketWorkspaceResponse>("/docket", {}, true),

  listUnpublishRequests: () =>
    request<{ requests: UnpublishRequestItem[] }>(
      "/admin/unpublish-queue",
      {},
      true,
    ),

  approveUnpublishRequest: (id: string) =>
    request<{ success: boolean }>(
      `/admin/unpublish-queue/${id}/approve`,
      { method: "POST" },
      true,
    ),

  rejectUnpublishRequest: (id: string) =>
    request<{ success: boolean }>(
      `/admin/unpublish-queue/${id}/reject`,
      { method: "POST" },
      true,
    ),

  getAdminAuthorActivity: () =>
    request<{ authors: AuthorActivitySummary[] }>(
      "/admin/author-activity",
      {},
      true,
    ),

  superAdminReviewDraft: (documentId: string) =>
    request<{ document: DocumentDetail }>(
      `/admin/documents/${documentId}/review`,
      { method: "POST" },
      true,
    ),
};

export interface DocketWorkspaceResponse {
  subscribedItems: { id: string; itemType: string; itemId: string }[];
  savedBooks: { id: string; itemType: string; itemId: string }[];
  readingProgress: unknown[];
  drafts: DocumentSummary[];
  published: DocumentSummary[];
  isAuthor: boolean;
  draftCount: number;
  publishedCount: number;
}

export interface AuthorActivitySummary {
  userId: string;
  email: string;
  role: string;
  draftCount: number;
  publishedCount: number;
  recentEvents: { id: string; eventType: string; documentId?: string; createdAt: string }[];
}

export interface LibraryQueryParams {
  q?: string;
  genreId?: string;
  authorId?: string;
  sort?: "newest" | "oldest" | "most_read" | "recently_published";
}

export interface LibraryBook {
  id: string;
  title: string;
  authorId: string;
  authorEmail: string;
  genreId?: string;
  genreName?: string;
  summary?: string;
  tags: string[];
  openCount: number;
  publishedAt?: string;
}

export interface RecommendedBook extends LibraryBook {
  score: number;
}

export interface BookPreview {
  documentId: string;
  title: string;
  authorId: string;
  authorEmail: string;
  previewText: string;
  wordCount: number;
  totalWords: number;
  requiresSubscription: boolean;
  hasAccess: boolean;
  isSubscribed: boolean;
}

export interface DocumentPage {
  documentId: string;
  title: string;
  page: number;
  totalPages: number;
  content: string;
}

export interface ReadingProgress {
  documentId: string;
  currentPage: number;
  completionPercentage: number;
  lastReadAt?: string;
}

export interface DocketBook {
  documentId: string;
  title: string;
  issuedAt: string;
  lastOpenedAt?: string;
  currentPage: number;
  completionPercentage: number;
}

export interface DocumentSummary {
  id: string;
  title: string;
  status: string;
  genreId?: string;
  genreName?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail extends DocumentSummary {
  content?: string;
}

export interface UnpublishRequestItem {
  id: string;
  documentId: string;
  authorId: string;
  status: string;
  justification: string;
  createdAt: string;
}

export function formatGenreLabel(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function formatRoleLabel(role: string): string {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
