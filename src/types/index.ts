// =========================================================
// SXRON APP — TYPES
// =========================================================

export interface City { id: number; name: string; slug?: string; }
export interface Category { id: number; name: string; slug?: string; icon?: string; products_count?: number; }

export interface ProductPhoto { id: number; name: string; content_type: string; size_bytes: number; url: string; is_cover?: boolean; sort_order?: number; }

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category_id?: number | null;
  category?: string | null;
  city?: City | string | null;
  city_id?: number | null;
  condition?: string | null;
  delivery?: string | null;
  photo_url?: string | null;
  photo_file_id?: string | null;
  photos?: ProductPhoto[];
  cover_photo_url?: string | null;
  status?: string | null;
  available?: boolean;
  is_available?: boolean;
  favorite?: boolean;
  is_favorite?: boolean;
  created_by?: number | null;
  seller_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

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

export type Page = "home" | "favorites" | "catalog" | "profile" | "messages" | "purchases" | "sales" | "notifications" | "support";
export interface ProductsResponse { products: Product[]; total?: number; page?: number; limit?: number; }
export interface Favorite { id: number; product_id: number; user_id?: number; created_at?: string; }

export interface Order {
  id: number;
  buyer_id: number;
  seller_id: number;
  product_id: number;
  product?: { id: number; name: string; price: number; photo_url?: string | null; seller_name?: string } | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  delivery_method: string;
  delivery_address: string;
  note: string;
  status: string;
  cancel_reason?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface Conversation {
  id: number;
  product_id?: number | null;
  other_user_id: number;
  other_user_name?: string | null;
  last_text?: string;
  last_message_at: string;
}

export interface ChatMessageMedia {
  id: number;
  name: string;
  content_type: string;
  size_bytes: number;
  url: string;
}

export interface ChatMessage {
  id: number;
  sender_id: number;
  text: string;
  media_id?: number | null;
  media?: ChatMessageMedia | null;
  created_at: string;
  read_at?: string | null;
}

export interface SxronNotification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  entity_type?: string | null;
  entity_id?: number | null;
  read_at?: string | null;
  created_at: string;
}

export type ProfileAccent = "cyan" | "violet" | "blue" | "sunset";
export type ProfileBanner = "aurora" | "violet" | "ocean" | "sunset";
export type AvatarShape = "rounded" | "circle" | "square";

export interface ProfileCustomization {
  displayName: string;
  bio: string;
  status: string;
  avatar: string;
  accent: ProfileAccent;
  banner: ProfileBanner;
  avatarShape: AvatarShape;
  usernameVisible: boolean;
  badgesVisible: boolean;
  activityVisible: boolean;
}

export interface User {
  id: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  city?: City | null;
  created_at?: string;
  bio?: string | null;
  display_name?: string | null;
  profile_status?: string | null;
  profile_accent?: ProfileAccent;
  profile_banner?: ProfileBanner;
  avatar_shape?: AvatarShape;
  username_visible?: boolean;
  badges_visible?: boolean;
  activity_visible?: boolean;
  listings_count?: number;
  active_listings_count?: number;
  sold_count?: number;
  views_count?: number;
  rating?: number | null;
  reviews_count?: number;
  last_seen_at?: string | null;
  is_online?: boolean;
  verified?: boolean;
}

export interface Seller {
  id: number;
  username?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  rating?: number;
  reviews_count?: number;
  listings_count?: number;
  verified?: boolean;
  city?: City | null;
  bio?: string | null;
}

export interface ApiError { detail?: string; message?: string; }
