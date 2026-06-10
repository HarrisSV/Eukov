import type { APIRequestContext } from "@playwright/test";
import { loadE2EEnv, resolveSuperAdminCredentials } from "../load-e2e-env";

loadE2EEnv();

export const API_BASE =
  process.env.PLAYWRIGHT_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8080/api/v1";

export interface TestSession {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: string };
}

function superAdminCredentials() {
  const { email, password, sources } = resolveSuperAdminCredentials();
  if (!password) {
    throw new Error(
      "SUPER_ADMIN_PASSWORD is not set. Add it to Build/.env (same values as your running backend) " +
        "or tests/e2e/.env.e2e. See tests/e2e/.env.e2e.example.",
    );
  }
  return { email, password, sources };
}

async function apiJson<T>(
  request: APIRequestContext,
  method: string,
  path: string,
  options: { body?: unknown; token?: string } = {},
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await request.fetch(`${API_BASE}${path}`, {
    method,
    headers,
    data: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = (await response.json().catch(() => ({}))) as T;
  return { status: response.status(), data };
}

export async function assertBackendHealthy(
  request: APIRequestContext,
): Promise<void> {
  const { status, data } = await apiJson<{ status: string }>(
    request,
    "GET",
    "/health",
  );
  if (status !== 200 || (data as { status?: string }).status !== "healthy") {
    throw new Error(
      `Backend not healthy at ${API_BASE}/health (status ${status}). ` +
        "Start Postgres, run migrations, then: cd backend && go run ./cmd/server",
    );
  }
}

export async function registerUser(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<void> {
  const { status } = await apiJson(request, "POST", "/auth/register", {
    body: { email, password },
  });
  if (status !== 201 && status !== 409) {
    throw new Error(`register failed for ${email}: ${status}`);
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loginUser(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<TestSession> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { status, data } = await apiJson<{
      accessToken: string;
      refreshToken: string;
      user: TestSession["user"];
    }>(request, "POST", "/auth/login", {
      body: { email, password },
    });
    if (status === 200) {
      return {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      };
    }
    lastStatus = status;
    if (status === 429 && attempt < 4) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    break;
  }
  throw new Error(`login failed for ${email}: ${lastStatus}`);
}

export async function savePreferences(
  request: APIRequestContext,
  session: TestSession,
  genres: string[],
): Promise<void> {
  const { status } = await apiJson(request, "POST", "/user/preferences", {
    token: session.accessToken,
    body: { genres },
  });
  if (status !== 200) {
    throw new Error(`save preferences failed: ${status}`);
  }
}

export async function loginSuperAdmin(
  request: APIRequestContext,
): Promise<TestSession> {
  const { email, password, sources } = superAdminCredentials();
  try {
    return await loginUser(request, email, password);
  } catch (err) {
    const hint =
      "Super admin is created once on first server start with SUPER_ADMIN_EMAIL/PASSWORD. " +
      "If login fails, those env vars must match what the server used originally, or set " +
      "E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD to an existing admin account.";
    const src =
      sources.length > 0 ? ` Credential sources: ${sources.join(", ")}.` : "";
    throw new Error(
      `${err instanceof Error ? err.message : String(err)}.${src} ${hint}`,
    );
  }
}

export async function createAdminSession(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<TestSession> {
  const presetAdminEmail = process.env.E2E_ADMIN_EMAIL;
  const presetAdminPassword = process.env.E2E_ADMIN_PASSWORD;
  if (presetAdminEmail && presetAdminPassword) {
    return loginUser(request, presetAdminEmail, presetAdminPassword);
  }

  await registerUser(request, email, password);
  const reader = await loginUser(request, email, password);
  const superAdmin = await loginSuperAdmin(request);

  const keyRes = await apiJson<{
    accessKey: string;
  }>(request, "POST", "/access-keys", { token: superAdmin.accessToken });
  if (keyRes.status !== 200 && keyRes.status !== 201) {
    throw new Error(`generate access key failed: ${keyRes.status}`);
  }

  const consumeRes = await apiJson<{ success: boolean; role: string }>(
    request,
    "POST",
    "/access-keys/consume",
    {
      token: reader.accessToken,
      body: { accessKey: keyRes.data.accessKey },
    },
  );
  if (consumeRes.status !== 200) {
    throw new Error(`consume access key failed: ${consumeRes.status}`);
  }

  return loginUser(request, email, password);
}

export async function createAuthorSession(
  request: APIRequestContext,
  authorEmail: string,
  authorPassword: string,
  adminEmail: string,
  adminPassword: string,
): Promise<TestSession> {
  await registerUser(request, authorEmail, authorPassword);
  const authorReader = await loginUser(request, authorEmail, authorPassword);
  await savePreferences(request, authorReader, ["philosophy"]);

  const appRes = await apiJson<{ id: string }>(
    request,
    "POST",
    "/author-applications",
    {
      token: authorReader.accessToken,
      body: {
        qualifications: "E2E test author qualifications for EUKOV phase 3.",
        experience: "Automated end-to-end publishing workflow coverage.",
      },
    },
  );
  if (appRes.status !== 201) {
    throw new Error(`author application failed: ${appRes.status}`);
  }

  const admin = await createAdminSession(request, adminEmail, adminPassword);
  const approveRes = await apiJson(
    request,
    "POST",
    `/admin/author-applications/${appRes.data.id}/approve`,
    { token: admin.accessToken },
  );
  if (approveRes.status !== 200) {
    throw new Error(`approve author failed: ${approveRes.status}`);
  }

  return loginUser(request, authorEmail, authorPassword);
}

export const MIN_PUBLISH_BODY =
  "E2E Phase 3 manuscript body. ".repeat(12).trim();

export interface DocumentSummary {
  id: string;
  title: string;
  status: string;
}

export async function createDocument(
  request: APIRequestContext,
  session: TestSession,
  title: string,
  content: string,
): Promise<DocumentSummary> {
  const { status, data } = await apiJson<{ document: DocumentSummary }>(
    request,
    "POST",
    "/documents",
    {
      token: session.accessToken,
      body: { title, content },
    },
  );
  if (status !== 201) {
    throw new Error(`create document failed: ${status}`);
  }
  return data.document;
}

export async function publishDocument(
  request: APIRequestContext,
  session: TestSession,
  documentId: string,
  payload: {
    genre: string;
    tags: string[];
    title?: string;
    content?: string;
  },
): Promise<{ status: number; error?: string }> {
  const { status, data } = await apiJson<{ error?: string }>(
    request,
    "POST",
    `/documents/${documentId}/publish`,
    {
      token: session.accessToken,
      body: payload,
    },
  );
  return { status, error: (data as { error?: string }).error };
}

export async function submitUnpublishRequest(
  request: APIRequestContext,
  session: TestSession,
  documentId: string,
  justification: string,
): Promise<number> {
  const { status } = await apiJson(
    request,
    "POST",
    `/documents/${documentId}/unpublish-request`,
    {
      token: session.accessToken,
      body: { justification },
    },
  );
  return status;
}

export async function updateDocument(
  request: APIRequestContext,
  session: TestSession,
  documentId: string,
  title: string,
  content: string,
): Promise<void> {
  const { status } = await apiJson(
    request,
    "PUT",
    `/documents/${documentId}`,
    {
      token: session.accessToken,
      body: { title, content },
    },
  );
  if (status !== 200) {
    throw new Error(`update document failed: ${status}`);
  }
}
