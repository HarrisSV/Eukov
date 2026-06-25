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
  firstName?: string;
  middleName?: string;
  lastName?: string;
  nickname?: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  nickname: string;
}

export function formatUserFullName(
  user: Pick<AuthUser, "firstName" | "middleName" | "lastName">,
): string {
  return [user.firstName, user.middleName, user.lastName]
    .filter(Boolean)
    .join(" ");
}

export function formatUserNickname(
  user: Pick<
    AuthUser,
    "firstName" | "middleName" | "lastName" | "nickname" | "email"
  >,
): string {
  if (user.nickname) {
    return user.nickname;
  }
  const fullName = formatUserFullName(user);
  if (fullName) {
    return fullName;
  }
  return user.email;
}

export function formatUserDisplayName(
  user: Pick<
    AuthUser,
    "firstName" | "middleName" | "lastName" | "nickname" | "email"
  >,
): string {
  const fullName = formatUserFullName(user);
  if (fullName && user.nickname) {
    return `${fullName} (${user.nickname})`;
  }
  if (fullName) {
    return fullName;
  }
  return user.email;
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

export interface AuthorApplicationAttachment {
  id: string;
  applicationId: string;
  fileName: string;
  mimeType?: string;
  fileSize: number;
}

export interface AuthorApplication {
  id: string;
  userId: string;
  subject?: string;
  messageBody?: string;
  qualifications: string;
  experience: string;
  status: string;
  adminReply?: string;
  userEmail?: string;
  userNickname?: string;
  userFullName?: string;
  attachments?: AuthorApplicationAttachment[];
}

export interface InboxMessage {
  id: string;
  userId: string;
  senderId?: string;
  messageType: string;
  subject: string;
  body: string;
  relatedId?: string;
  readAt?: string;
  createdAt: string;
  metadata?: {
    includeAccessKey?: boolean;
    approveAuthor?: boolean;
  };
}

async function requestMultipart<T>(path: string, formData: FormData): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
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

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
}

export const api = {
  health: () => request<HealthResponse>("/health"),

  register: (input: RegisterInput) =>
    request<RegisterResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
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

  submitAuthorRequest: (input: {
    subject: string;
    message: string;
    attachments: File[];
  }) => {
    const formData = new FormData();
    formData.append("subject", input.subject);
    formData.append("message", input.message);
    for (const file of input.attachments) {
      formData.append("attachments", file);
    }
    return requestMultipart<{ id: string; status: string; application: AuthorApplication }>(
      "/author-applications/request",
      formData,
    );
  },

  getMyAuthorApplication: () =>
    request<{ application: AuthorApplication }>(
      "/author-applications/mine",
      {},
      true,
    ),

  getInbox: () =>
    request<{ messages: InboxMessage[] }>("/inbox", {}, true),

  markInboxRead: (messageId: string) =>
    request<{ success: boolean }>(
      `/inbox/${messageId}/read`,
      { method: "PATCH" },
      true,
    ),

  replyAuthorApplication: (
    id: string,
    input: { message: string; includeAccessKey?: boolean },
  ) =>
    request<{ application: AuthorApplication }>(
      `/admin/author-applications/${id}/reply`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      true,
    ),

  downloadAuthorAttachment: (attachmentId: string) =>
    `${API_BASE}/author-applications/attachments/${attachmentId}`,

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
    request<{ books: RecommendedBook[]; aiEnabled?: boolean }>(
      `/library/recommended?limit=${limit}`,
      {},
      true,
    ),

  aiProofread: (text: string) =>
    request<{ result: ProofreadResult }>(
      "/ai/proofread",
      {
        method: "POST",
        body: JSON.stringify({ text }),
      },
      true,
    ),

  getDocumentAISummary: (documentId: string) =>
    request<{ summary: BookSummaryResult }>(
      `/documents/${documentId}/ai-summary`,
      {},
      true,
    ),

  getDocumentAIFullSummary: (documentId: string) =>
    request<{ summary: BookSummaryResult }>(
      `/documents/${documentId}/ai-full-summary`,
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

  createDocument: (payload: SaveDocumentPayload) =>
    request<{ document: DocumentDetail }>(
      "/documents",
      { method: "POST", body: JSON.stringify(payload) },
      true,
    ),

  updateDocument: (id: string, payload: SaveDocumentPayload) =>
    request<{ document: DocumentDetail }>(
      `/documents/${id}`,
      { method: "PUT", body: JSON.stringify(payload) },
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
    payload: {
      genre: string;
      tags: string[];
      title?: string;
      content?: string;
      contentFormat?: "docx" | "html";
      readerHtml?: string;
      coverUrl?: string;
      authorName?: string;
    },
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

  takedownPublishedScript: (documentId: string) =>
    request<{ document: DocumentDetail }>(
      `/documents/${documentId}/takedown`,
      { method: "POST" },
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
  displayName?: string;
  nickname?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  role: string;
  draftCount: number;
  publishedCount: number;
  recentEvents: { id: string; eventType: string; documentId?: string; createdAt: string }[];
}

export function formatAuthorActivityLabel(
  author: Pick<
    AuthorActivitySummary,
    "displayName" | "nickname" | "firstName" | "middleName" | "lastName" | "email"
  >,
): string {
  if (author.displayName?.trim()) {
    return author.displayName.trim();
  }
  if (author.nickname?.trim()) {
    return author.nickname.trim();
  }
  const fullName = formatUserFullName(author);
  if (fullName) {
    return fullName;
  }
  return "Unknown author";
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
  authorName?: string;
  genreId?: string;
  genreName?: string;
  summary?: string;
  coverUrl?: string;
  tags: string[];
  openCount: number;
  publishedAt?: string;
}

export interface RecommendedBook extends LibraryBook {
  score: number;
  reason?: string;
}

export interface ProofreadResult {
  correctedText: string;
  correctedHtml: string;
  usedAi: boolean;
}

export interface BookSummaryResult {
  documentId: string;
  title: string;
  summary: string;
  usedAi: boolean;
  wordCount?: number;
  imageCount?: number;
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
  contentFormat?: "docx" | "html";
}

export type SaveDocumentPayload = {
  title: string;
  content: string;
  contentFormat?: "docx" | "html";
  readerHtml?: string;
};

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
