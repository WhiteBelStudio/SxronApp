import type {
  Category,
  City,
  CreateProductData,
  Product,
} from "../types";


const API_URL =
  "http://127.0.0.1:8000/api";


async function request<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      headers: {
        "Content-Type": "application/json",

        ...(options?.headers ?? {}),
      },

      ...options,
    },
  );


  if (!response.ok) {
    let message =
      `Ошибка API: ${response.status}`;

    try {
      const data =
        await response.json();

      if (
        typeof data?.detail ===
        "string"
      ) {
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
  const searchParams =
    new URLSearchParams();


  if (params?.search) {
    searchParams.set(
      "search",
      params.search,
    );
  }


  if (params?.category) {
    searchParams.set(
      "category",
      params.category,
    );
  }


  if (params?.city) {
    searchParams.set(
      "city",
      params.city,
    );
  }


  const query =
    searchParams.toString();


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