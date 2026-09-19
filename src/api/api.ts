import type {
  Category,
  City,
  CreateProductData,
  Product,
  ProfileAccent,
  ProfileBanner,
  AvatarShape,
  User,
  Order,
  Conversation,
  ChatMessage,
  SxronNotification,
} from "../types";

const DEFAULT_API_URL =
  typeof window !== "undefined" && window.location.protocol === "file:"
    ? "http://127.0.0.1:8000"
    : "/api";

const API_URL = (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/$/, "");

const CLIENT_ID_STORAGE_KEY = "sxron_client_id";
const AUTH_TOKEN_STORAGE_KEY = "sxron_auth_token";

function getClientId(): string {
  if (typeof window === "undefined") return "server";
  let clientId = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
  }
  return clientId;
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export function getClientIdentifier(): string { return getClientId(); }

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const isReadRequest = !options?.method || options.method.toUpperCase() === "GET";
  const maxAttempts = isReadRequest ? 3 : 1;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        cache: isReadRequest ? "no-store" : options?.cache,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "X-SXRON-Client-ID": getClientId(),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options?.headers ?? {}),
        },
      });

      if (!response.ok) {
        let message = `Ошибка API: ${response.status}`;
        try {
          const data = await response.json();
          if (typeof data?.detail === "string") message = data.detail;
        } catch { /* Ответ не содержит JSON. */ }
        throw new Error(message);
      }
      return response.json() as Promise<T>;
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("Не удалось связаться с сервером SXRON.");
}

export interface AuthStartResponse {
  challenge_id: string;
  channel: "email" | "sms";
  destination: string;
  expires_in: number;
  next: string;
  debug_code?: string;
}

export interface RecoveryStartResponse {
  accepted: boolean;
  message: string;
  challenge_id?: string;
  destination?: string;
  expires_in?: number;
  debug_code?: string;
}

export interface RecoveryVerifyResponse {
  verified: boolean;
  reset_token: string;
  expires_in: number;
}

export interface RecoveryResetResponse {
  authenticated: boolean;
  session_token: string;
  user_id: number;
  message: string;
}

export interface AuthUser extends User {
  email?: string | null;
  email_verified?: boolean;
  phone?: string | null;
  phone_verified?: boolean;
}

export interface AuthResult {
  authenticated: boolean;
  session_token?: string;
  user?: AuthUser;
  is_admin?: boolean;
  is_owner?: boolean;
  next?: string;
  challenge_id?: string;
  channel?: "email" | "sms";
  destination?: string;
  expires_in?: number;
  debug_code?: string;
  user_id?: number;
}

export async function startOwnerLogin(): Promise<AuthResult> { return request<AuthResult>("/auth/owner", { method: "POST" }); }
export async function startRegistration(method: "email" | "phone", identifier: string, password?: string): Promise<AuthStartResponse> { return request<AuthStartResponse>("/auth/start", { method: "POST", body: JSON.stringify({ method, identifier, ...(password ? { password } : {}) }) }); }
export async function verifyRegistration(challengeId: string, code: string): Promise<AuthResult> { return request<AuthResult>("/auth/verify", { method: "POST", body: JSON.stringify({ challenge_id: challengeId, code }) }); }
export async function resendAuthCode(challengeId: string): Promise<AuthStartResponse> { return request<AuthStartResponse>("/auth/resend", { method: "POST", body: JSON.stringify({ challenge_id: challengeId }) }); }
export async function loginWithPassword(identifier: string, password: string, remember: boolean): Promise<AuthResult> { return request<AuthResult>("/auth/login", { method: "POST", body: JSON.stringify({ identifier, password, remember }) }); }
export async function startLogin(identifier: string): Promise<AuthStartResponse> { return request<AuthStartResponse>("/auth/login/start", { method: "POST", body: JSON.stringify({ identifier }) }); }
export async function verifyLogin(challengeId: string, code: string): Promise<AuthResult> { return request<AuthResult>("/auth/login/verify", { method: "POST", body: JSON.stringify({ challenge_id: challengeId, code }) }); }
export async function setPassword(password: string): Promise<void> { await request("/auth/password/set", { method: "POST", body: JSON.stringify({ password }) }); }
export async function getAuthMe(): Promise<AuthMeResponse> { return request<AuthMeResponse>("/auth/me"); }
export async function logout(): Promise<void> { try { await request("/auth/logout", { method: "POST" }); } finally { clearAuthToken(); } }

export async function startOwnerRecovery(email: string): Promise<RecoveryStartResponse> {
  return request<RecoveryStartResponse>("/auth/recovery/start", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function verifyOwnerRecovery(challengeId: string, code: string): Promise<RecoveryVerifyResponse> {
  return request<RecoveryVerifyResponse>("/auth/recovery/verify", {
    method: "POST",
    body: JSON.stringify({ challenge_id: challengeId, code }),
  });
}

export async function resetOwnerPassword(resetToken: string, password: string): Promise<RecoveryResetResponse> {
  return request<RecoveryResetResponse>("/auth/recovery/reset", {
    method: "POST",
    body: JSON.stringify({ reset_token: resetToken, password }),
  });
}

export interface SessionInfo {
  id: number;
  user_id?: number;
  client_id?: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  created_at: string;
  expires_at: string;
  revoked_at?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  device?: string | null;
  platform?: string | null;
  client_type?: string | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
}
export interface SessionsResponse { sessions: SessionInfo[]; }
export async function getSessions(): Promise<SessionsResponse> { return request<SessionsResponse>("/auth/sessions"); }
export async function revokeSession(sessionId: number): Promise<{ ok: boolean }> { return request<{ ok: boolean }>(`/auth/sessions/${sessionId}`, { method: "DELETE" }); }
export async function revokeAllSessions(): Promise<{ ok: boolean }> { return request<{ ok: boolean }>("/auth/sessions/revoke-all", { method: "POST" }); }
export async function getAdminSessions(): Promise<SessionsResponse> { return request<SessionsResponse>("/admin/sessions"); }


export async function getFavorites(): Promise<Product[]> {
  return request<Product[]>("/favorites");
}

export async function addFavorite(productId: number): Promise<{ ok: boolean; favorite: boolean }> {
  return request<{ ok: boolean; favorite: boolean }>(`/favorites/${productId}`, { method: "POST" });
}

export async function removeFavorite(productId: number): Promise<{ ok: boolean; favorite: boolean }> {
  return request<{ ok: boolean; favorite: boolean }>(`/favorites/${productId}`, { method: "DELETE" });
}

export async function uploadProductImages(productId: number, files: File[]): Promise<{ photos: NonNullable<Product["photos"]> }> {
  const form = new FormData();
  for (const file of files) form.append("files", file, file.name);
  const response = await fetch(`${API_URL}/products/${productId}/images`, {
    method: "POST",
    body: form,
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
      "X-SXRON-Client-ID": getClientId(),
      ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
    },
  });
  if (!response.ok) {
    let message = `Ошибка загрузки фото: ${response.status}`;
    try { const data = await response.json(); if (typeof data?.detail === "string") message = data.detail; } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<{ photos: NonNullable<Product["photos"]> }>;
}

export async function deleteProductImage(productId: number, mediaId: number): Promise<{ ok: boolean; photos: NonNullable<Product["photos"]> }> {
  return request<{ ok: boolean; photos: NonNullable<Product["photos"]> }>(`/products/${productId}/images/${mediaId}`, { method: "DELETE" });
}

export async function createOrder(data: { product_id: number; quantity?: number; delivery_method?: string; delivery_address?: string; note?: string }): Promise<Order> {
  return request<Order>("/orders", { method: "POST", body: JSON.stringify(data) });
}

export async function getOrders(side: "all" | "buying" | "selling" = "all"): Promise<{ orders: Order[] }> {
  return request<{ orders: Order[] }>(`/orders?side=${encodeURIComponent(side)}`);
}

export async function updateOrder(orderId: number, status: string, note = ""): Promise<Order> {
  return request<Order>(`/orders/${orderId}`, { method: "PATCH", body: JSON.stringify({ status, note }) });
}

export async function getConversations(): Promise<{ conversations: Conversation[] }> {
  return request<{ conversations: Conversation[] }>("/conversations");
}

export async function createConversation(data: { seller_id: number; product_id?: number; text?: string }): Promise<{ conversation_id: number }> {
  return request<{ conversation_id: number }>("/conversations", { method: "POST", body: JSON.stringify(data) });
}

export async function getMessages(conversationId: number): Promise<{ messages: ChatMessage[] }> {
  return request<{ messages: ChatMessage[] }>(`/conversations/${conversationId}/messages`);
}

export async function sendMessage(conversationId: number, text: string, mediaId?: number): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text, media_id: mediaId ?? null }),
  });
}

export async function uploadMedia(file: File, kind: "chat" | "general" | "avatar" = "chat"): Promise<{ id: number; name: string; content_type: string; size_bytes: number; url: string }> {
  const form = new FormData();
  form.append("file", file, file.name);
  const response = await fetch(`${API_URL}/media/upload?kind=${encodeURIComponent(kind)}`, {
    method: "POST",
    body: form,
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
      "X-SXRON-Client-ID": getClientId(),
      ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
    },
  });
  if (!response.ok) {
    let message = `Ошибка загрузки файла: ${response.status}`;
    try { const data = await response.json(); if (typeof data?.detail === "string") message = data.detail; } catch {}
    throw new Error(message);
  }
  return response.json();
}

export async function getNotifications(): Promise<{ notifications: SxronNotification[] }> {
  return request<{ notifications: SxronNotification[] }>("/notifications");
}

export async function markNotificationRead(notificationId: number, read = true): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/notifications/${notificationId}`, { method: "PATCH", body: JSON.stringify({ read }) });
}

export async function getProducts(params?: { search?: string; category?: string; city?: string }): Promise<Product[]> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.category) searchParams.set("category", params.category);
  if (params?.city) searchParams.set("city", params.city);
  const query = searchParams.toString();
  return request<Product[]>(`/products${query ? `?${query}` : ""}`);
}
export async function getProduct(productId: number): Promise<Product> { return request<Product>(`/products/${productId}`); }
export async function createProduct(data: CreateProductData): Promise<Product> { return request<Product>("/products", { method: "POST", body: JSON.stringify(data) }); }
export async function updateProduct(productId: number, data: CreateProductData): Promise<Product> { return request<Product>(`/products/${productId}`, { method: "PUT", body: JSON.stringify(data) }); }
export async function deleteProduct(productId: number): Promise<{ ok: boolean }> { return request<{ ok: boolean }>(`/products/${productId}`, { method: "DELETE" }); }
export async function getCategories(): Promise<Category[]> { return request<Category[]>("/categories"); }
export async function getCities(): Promise<City[]> { return request<City[]>("/cities"); }
export async function checkHealth(): Promise<{ status: string; app: string; version: string }> { return request("/health"); }

export interface AdminUser { id: number; username: string | null; first_name: string | null; last_name: string | null; role: "owner" | "admin"; added_at: string; }
export interface MeResponse { user: User; is_admin: boolean; is_owner: boolean; }
export interface AuthMeResponse { user: AuthUser; is_admin: boolean; is_owner: boolean; }
export interface AdminsResponse { admins: AdminUser[]; }
export interface AdminMutationResponse { ok: boolean; message: string; admin?: AdminUser | null; }

export interface ProfileUpdateData {
  display_name?: string;
  bio?: string;
  profile_status?: string;
  avatar_url?: string | null;
  profile_accent?: ProfileAccent;
  profile_banner?: ProfileBanner;
  avatar_shape?: AvatarShape;
  username_visible?: boolean;
  badges_visible?: boolean;
  activity_visible?: boolean;
  city_id?: number | null;
}

export interface ProfileResponse { user: User; is_admin: boolean; is_owner: boolean; }
export async function getMe(): Promise<MeResponse> { return request<MeResponse>("/me"); }
export async function getProfile(): Promise<ProfileResponse> { return request<ProfileResponse>("/me/profile"); }
export async function updateProfile(data: ProfileUpdateData): Promise<ProfileResponse> { return request<ProfileResponse>("/me/profile", { method: "PUT", body: JSON.stringify(data) }); }
export async function getAdmins(): Promise<AdminsResponse> { return request<AdminsResponse>("/admins"); }
export async function addAdmin(userId: number): Promise<AdminMutationResponse> { return request<AdminMutationResponse>("/admins/add", { method: "POST", body: JSON.stringify({ user_id: userId }) }); }
export async function removeAdmin(userId: number): Promise<AdminMutationResponse> { return request<AdminMutationResponse>("/admins/remove", { method: "POST", body: JSON.stringify({ user_id: userId }) }); }