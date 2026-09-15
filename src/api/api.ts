import type {
  Category,
  City,
  CreateProductData,
  Product,
  User,
} from "../types";


const API_URL = (
  import.meta.env.VITE_API_URL || ""
).replace(/\/$/, "");


function getTelegramInitData(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const telegram = (
    window as Window & {
      Telegram?: {
        WebApp?: {
          initData?: string;
        };
      };
    }
  ).Telegram;

  return telegram?.WebApp?.initData || "";
}


async function request<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  if (!API_URL) {
    throw new Error(
      "VITE_API_URL не настроен. Укажи адрес SXRON API в настройках Vercel.",
    );
  }

  const initData = getTelegramInitData();

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(initData
          ? { "X-Telegram-Init-Data": initData }
          : {}),
        ...(options?.headers ?? {}),
      },
    },
  );

  if (!response.ok) {
    let message = `Ошибка API: ${response.status}`;

    try {
      const data = await response.json();

      if (typeof data?.detail === "string") {
        message = data.detail;
      }
    } catch {
      // Игнорируем ошибку JSON.
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

  if (params?.search) {
    searchParams.set("search", params.search);
  }

  if (params?.category) {
    searchParams.set("category", params.category);
  }

  if (params?.city) {
    searchParams.set("city", params.city);
  }

  const query = searchParams.toString();

  return request<Product[]>(
    `/products${query ? `?${query}` : ""}`,
  );
}


export async function getProduct(
  productId: number,
): Promise<Product> {
  return request<Product>(
    `/products/${productId}`,
  );
}


export async function createProduct(
  data: CreateProductData,
): Promise<Product> {
  return request<Product>(
    "/products",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}


export async function getCategories(): Promise<Category[]> {
  return request<Category[]>(
    "/categories",
  );
}


export async function getCities(): Promise<City[]> {
  return request<City[]>(
    "/cities",
  );
}


export async function checkHealth(): Promise<{
  status: string;
  app: string;
  version: string;
}> {
  return request(
    "/health",
  );
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


export async function addAdmin(
  userId: number,
): Promise<AdminMutationResponse> {
  return request<AdminMutationResponse>(
    "/admins/add",
    {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    },
  );
}


export async function removeAdmin(
  userId: number,
): Promise<AdminMutationResponse> {
  return request<AdminMutationResponse>(
    "/admins/remove",
    {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    },
  );
}
