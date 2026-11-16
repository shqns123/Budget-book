import * as SecureStore from "expo-secure-store";

const SERVER_KEY = "ledger.server";
const TOKEN_KEY = "ledger.token";

let serverUrl = "";
let token = "";
let onUnauthorized: (() => void) | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** "ledger.example.com" → "https://ledger.example.com" (no trailing slash). */
export function normalizeServerUrl(input: string) {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Server address set at build time (EXPO_PUBLIC_API_URL: mobile/.env.local in development,
 * eas.json `env` for APK/EAS builds).
 */
export const BUILT_IN_SERVER = normalizeServerUrl(process.env.EXPO_PUBLIC_API_URL ?? "");
/**
 * Release builds with a built-in address always use it, and the login screen drops the address
 * field. Development builds only prefill it, so another server can still be tried.
 */
export const SERVER_LOCKED = !__DEV__ && Boolean(BUILT_IN_SERVER);

export async function loadSession() {
  serverUrl = SERVER_LOCKED
    ? BUILT_IN_SERVER
    : ((await SecureStore.getItemAsync(SERVER_KEY)) ?? BUILT_IN_SERVER);
  token = (await SecureStore.getItemAsync(TOKEN_KEY)) ?? "";
  return { serverUrl, signedIn: Boolean(serverUrl && token) };
}

export const getServerUrl = () => serverUrl;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function storeToken(next: string) {
  token = next;
  if (next) await SecureStore.setItemAsync(TOKEN_KEY, next);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  if (!serverUrl) throw new ApiError("서버 주소가 설정되지 않았어요.", 0);
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(`${serverUrl}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("서버에 연결하지 못했어요. 인터넷 연결과 서버 주소를 확인해 주세요.", 0);
  }
  // Sliding session: the server hands back a fresh token on every use.
  const refreshed = response.headers.get("x-session-token");
  if (refreshed && refreshed !== token) void storeToken(refreshed);
  // 401: signed out. 403 on the ledger data: no longer a member (the owner removed them).
  if (token && (response.status === 401 || (response.status === 403 && path.startsWith("/api/state/")))) {
    await storeToken("");
    onUnauthorized?.();
  }
  return response;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new ApiError(payload.error || "요청을 처리하지 못했어요.", response.status);
  }
  return payload;
}

/** ID / password login: the owner's fallback to Google sign-in. */
export function login(server: string, username: string, password: string) {
  return signInWith(server, "/api/auth/login", { username, password });
}

/** Google sign-in with an ID token from Google Sign-In (lib/google). */
export function loginWithGoogle(server: string, idToken: string) {
  return signInWith(server, "/api/auth/google", { idToken });
}

async function signInWith(server: string, path: string, body: Record<string, string>) {
  const url = SERVER_LOCKED ? BUILT_IN_SERVER : normalizeServerUrl(server);
  if (!url) throw new ApiError("서버 주소를 입력해 주세요.", 0);
  let response: Response;
  try {
    response = await fetch(`${url}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, client: "native" }),
    });
  } catch {
    throw new ApiError("서버에 연결하지 못했어요. 주소를 다시 확인해 주세요.", 0);
  }
  const payload = (await response.json().catch(() => ({}))) as {
    token?: string;
    error?: string;
  };
  if (!response.ok) {
    throw new ApiError(payload.error || "로그인하지 못했어요.", response.status);
  }
  if (!payload.token) {
    throw new ApiError(
      "서버가 앱 로그인을 지원하지 않아요. NAS의 가계부 컨테이너를 최신 버전으로 다시 빌드해 주세요.",
      response.status,
    );
  }
  serverUrl = url;
  await SecureStore.setItemAsync(SERVER_KEY, url);
  await storeToken(payload.token);
}

export async function logout() {
  await storeToken("");
}

export async function readState<T>(key: string): Promise<T> {
  const payload = await apiJson<{ value: T }>(`/api/state/${key}`);
  return payload.value;
}

export async function writeState<T>(key: string, value: T) {
  await apiJson(`/api/state/${key}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
}
