import type {
  Category,
  City,
  CreateProductData,
  Product,
  User,
} from "../types";

// In development Vite proxies /api to FastAPI.
// In the packaged Electron app the renderer uses file://, so requests must
// go directly to the bundled local API process.
const DEFAULT_API_URL =
  typeof window !== "undefined" && window.location.protocol === "file:"
    ? "http://127.0.0.1:8000"
    : "/api";

const API_URL = (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/$/, "");

const CLIENT_ID_STORAGE_KEY = "sxron_client_id";

function getClientId(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  let clientId = localStorage.getItem(CLIENT_ID_STORAGE_KEY);

  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
  }

  return clientId;
}

async function request<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-SXRON-Client-ID": getClientId(),
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Ошибка API: ${response.status}`;

    try {
      const data = await response.json();

      if (typeof data?.detail === "string") {
        message = data.detail;
      }
    } catch {
      // Ответ не содержит JSON.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function getProducts(
  params?: {
    search?: string;
    category?: string;
    city?: string;
  },
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
  return request<Product>("/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getCategories(): Promise<Category[]> {
  return request<Category[]>("/categories");
}

export async function getCities(): Promise<City[]> {
  return request<City[]>("/cities");
}

export async function checkHealth(): Promise<{
  status: string;
  app: string;
  version: string;
}> {
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
