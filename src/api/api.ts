import type {
  Category,
  City,
  CreateProductData,
  Product,
  User,
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

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
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
    } catch {
      // Ответ не содержит JSON.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export interface AuthStartResponse {
  challenge_id: string;
  channel: "email" | "sms";
  destination: string;
  expires_in: number;
  next: string;
  debug_code?: string;
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
}

export interface AuthMeResponse {
  user: AuthUser;
  is_admin: boolean;
  is_owner: boolean;
}

export async function startRegistration(
  method: "email" | "phone",
  identifier: string,
): Promise<AuthStartResponse> {
  return request<AuthStartResponse>("/auth/start", {
    method: "POST",
    body: JSON.stringify({ method, identifier }),
  });
}

export async function verifyRegistration(
  challengeId: string,
  code: string,
): Promise<AuthResult> {
  return request<AuthResult>("/auth/verify", {
    method: "POST",
    body: JSON.stringify({ challenge_id: challengeId, code }),
  });
}

export async function resendAuthCode(challengeId: string): Promise<AuthStartResponse> {
  return request<AuthStartResponse>("/auth/resend", {
    method: "POST",
    body: JSON.stringify({ challenge_id: challengeId }),
  });
}

export async function startLogin(identifier: string): Promise<AuthStartResponse> {
  return request<AuthStartResponse>("/auth/login/start", {
    method: "POST",
    body: JSON.stringify({ identifier }),
  });
}

export async function verifyLogin(challengeId: string, code: string): Promise<AuthResult> {
  return request<AuthResult>("/auth/login/verify", {
    method: "POST",
    body: JSON.stringify({ challenge_id: challengeId, code }),
  });
}

export async function getAuthMe(): Promise<AuthMeResponse> {
  return request<AuthMeResponse>("/auth/me");
}

export async function logout(): Promise<void> {
  try {
    await request("/auth/logout", { method: "POST" });
  } finally {
    clearAuthToken();
  }
}

export async function getProducts(
  params?: { search?: string; category?: string; city?: string },
): Promise<Product[]> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.category) searchParams.set("category", params.category);
  if (params?.city) searchParams.set("city", params.city);
  const query = searchParams.toString();
  return request<Product[]>(`/products${query ? `?${query}` : ""}`);
}

export async function getProduct(productId: number): Promise<Product> {
  return request<Product>(`/products/${productId}`);
}

export async function createProduct(data: CreateProductData): Promise<Product> {
  return request<Product>("/products", { method: "POST", body: JSON.stringify(data) });
}

export async function getCategories(): Promise<Category[]> {
  return request<Category[]>("/categories");
}

export async function getCities(): Promise<City[]> {
  return request<City[]>("/cities");
}

export async function checkHealth(): Promise<{ status: string; app: string; version: string }> {
  return request("/health");
}

export interface AdminUser {
  id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  role: "owner" | "admin";
  added_at: string;
}

export interface MeResponse {
  user: User;
  is_admin: boolean;
  is_owner: boolean;
}

export interface AdminsResponse {
  admins: AdminUser[];
}

export interface AdminMutationResponse {
  ok: boolean;
  message: string;
  admin?: AdminUser | null;
}

export async function getMe(): Promise<MeResponse> {
  return request<MeResponse>("/me");
}

export async function getAdmins(): Promise<AdminsResponse> {
  return request<AdminsResponse>("/admins");
}

export async function addAdmin(userId: number): Promise<AdminMutationResponse> {
  return request<AdminMutationResponse>("/admins/add", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function removeAdmin(userId: number): Promise<AdminMutationResponse> {
  return request<AdminMutationResponse>("/admins/remove", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}
