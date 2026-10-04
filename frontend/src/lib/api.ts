export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const TOKEN_KEY = 'heizen_access_token';
const USER_CACHE_TTL_MS = 15_000;
let cachedUser: SessionUser | null = null;
let cachedUserAt = 0;
let userRequest: Promise<SessionUser> | null = null;

export function getToken() {
  return typeof window === 'undefined'
    ? null
    : window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
  invalidateCurrentUser();
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
  invalidateCurrentUser();
}

function invalidateCurrentUser() {
  cachedUser = null;
  cachedUserAt = 0;
  userRequest = null;
}

export function getCurrentUser() {
  if (cachedUser && Date.now() - cachedUserAt < USER_CACHE_TTL_MS) {
    return Promise.resolve(cachedUser);
  }

  if (!userRequest) {
    userRequest = api<SessionUser>('/auth/me')
      .then((user) => {
        cachedUser = user;
        cachedUserAt = Date.now();
        return user;
      })
      .finally(() => {
        userRequest = null;
      });
  }

  return userRequest;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured');
  }

  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      `Unable to reach the backend at ${baseUrl}. Check that NestJS is running and NEXT_PUBLIC_API_URL is correct.`,
    );
  }

  const text = await response.text();
  let body: unknown;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const errorBody =
      body && typeof body === 'object'
        ? (body as { message?: unknown; error?: unknown })
        : undefined;
    const message = Array.isArray(errorBody?.message)
      ? errorBody.message.join('; ')
      : typeof errorBody?.message === 'string'
        ? errorBody.message
        : typeof errorBody?.error === 'string'
          ? errorBody.error
          : typeof body === 'string' && body
            ? body
            : `Request failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as T;
}

export function jsonBody(value: unknown): RequestInit {
  return {
    method: 'POST',
    body: JSON.stringify(value),
  };
}

export function patchBody(value: unknown): RequestInit {
  return {
    method: 'PATCH',
    body: JSON.stringify(value),
  };
}

export function can(user: SessionUser | null, permission: string) {
  return Boolean(user?.permissions.includes(permission));
}
