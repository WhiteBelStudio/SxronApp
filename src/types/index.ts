// =========================================================
// SXRON APP — TYPES
// =========================================================

// =========================================================
// CITY
// =========================================================

export interface City {
  id: number;
  name: string;
  slug?: string;
}

// =========================================================
// CATEGORY
// =========================================================

export interface Category {
  id: number;
  name: string;
  slug?: string;
  icon?: string;
  products_count?: number;
}

// =========================================================
// PRODUCT
// =========================================================

export interface Product {
  id: number;

  name: string;
  description: string;
  price: number;

  // Категория
  category_id?: number | null;
  category?: string | null;

  // Город
  city?: City | string | null;
  city_id?: number | null;

  // Характеристики
  condition?: string | null;
  delivery?: string | null;

  // Фото
  photo_url?: string | null;
  photo_file_id?: string | null;

  // Статус
  status?: string | null;

  // Доступность
  available?: boolean;
  is_available?: boolean;

  // Избранное
  favorite?: boolean;
  is_favorite?: boolean;

  // Даты
  created_at?: string;
  updated_at?: string;
}

// =========================================================
// CREATE PRODUCT
// =========================================================

export interface CreateProductData {
  name: string;
  description: string;
  price: number;

  category?: string | null;
  category_id?: number | null;

  city?: City | string | null;
  city_id?: number | null;

  condition?: string | null;
  delivery?: string | null;

  photo_url?: string | null;
}

// =========================================================
// PAGE
// =========================================================

export type Page =
  | "home"
  | "favorites"
  | "catalog"
  | "profile";

// =========================================================
// PRODUCTS RESPONSE
// =========================================================

export interface ProductsResponse {
  products: Product[];

  total?: number;
  page?: number;
  limit?: number;
}

// =========================================================
// FAVORITE
// =========================================================

export interface Favorite {
  id: number;
  product_id: number;
  user_id?: number;
  created_at?: string;
}

// =========================================================
// USER
// =========================================================

export interface User {
  id: number;

  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;

  avatar_url?: string | null;

  city?: City | null;

  created_at?: string;
}

// =========================================================
// SELLER
// =========================================================

export interface Seller {
  id: number;

  username?: string | null;
  name?: string | null;

  avatar_url?: string | null;

  rating?: number;
  reviews_count?: number;
  listings_count?: number;
}

// =========================================================
// API ERROR
// =========================================================

export interface ApiError {
  detail?: string;
  message?: string;
}