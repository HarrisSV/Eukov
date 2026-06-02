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

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

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

export interface LoginResponse {
  success: boolean;
  userId: string;
  email: string;
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

  getGenres: () => request<GenresResponse>("/genres"),

  savePreferences: (userId: string, genres: string[]) =>
    request<{ success: boolean }>("/user/preferences", {
      method: "POST",
      body: JSON.stringify({ userId, genres }),
    }),

  getPreferences: (userId: string) =>
    request<PreferencesResponse>(`/user/${userId}/preferences`),
};

export function formatGenreLabel(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}
