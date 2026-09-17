import type { Product, User } from "../types";

const DEFAULT_API_URL =
  typeof window !== "undefined" && window.location.protocol === "file:"
    ? "http://127.0.0.1:8000"
    : "/api";

const API_URL = (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/$/, "");

function getClientId(): string {
  if (typeof window === "undefined") return "server";
  const key = "sxron_client_id";
  let clientId = localStorage.getItem(key);
  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem(key, clientId);
  }
  return clientId;
}

export interface PublicSellerReview {
  id: number;
  rating: number;
  text?: string | null;
  author_name?: string | null;
  created_at?: string | null;
}

export interface PublicSellerResponse {
  seller: User & {
    is_owner?: boolean;
  };
  listings: Product[];
  rating?: number | null;
  reviews_count: number;
  reviews: PublicSellerReview[];
}

export async function getPublicSellerProfile(userId: number): Promise<PublicSellerResponse> {
  const response = await fetch(`${API_URL}/public/sellers/${userId}`, {
    headers: {
      "Content-Type": "application/json",
      "X-SXRON-Client-ID": getClientId(),
    },
  });

  if (!response.ok) {
    let message = `Ошибка API: ${response.status}`;
    try {
      const data = await response.json();
      if (typeof data?.detail === "string") message = data.detail;
    } catch {
      // Keep the generic status message.
    }
    throw new Error(message);
  }

  return response.json() as Promise<PublicSellerResponse>;
}
