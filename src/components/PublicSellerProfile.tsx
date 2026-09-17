import { useEffect, useMemo, useState } from "react";

import type { Product } from "../types";
import { getProducts } from "../api/api";
import { getPublicSellerProfile, type PublicSellerResponse } from "../api/publicSeller";
import "../styles/public-seller.css";

interface ProductSeed {
  name: string;
  category: string;
  city: string;
  price: number;
}

interface Props {
  onOpenProduct?: (product: Product) => void;
}

function parsePrice(value: string): number {
  const normalized = value
    .replace(/\s/g, "")
    .replace(/[^0-9,.-]/g, "")
    .replace(",", ".");
  return Number(normalized) || 0;
}

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "S";
}

function closeUnderlyingSellerModal(): void {
  document.querySelector<HTMLElement>(".sxron-seller-modal .sxron-modal-close")?.click();
}

function extractProductSeed(modal: Element): ProductSeed | null {
  const name = modal.querySelector("h2")?.textContent?.trim() || "";
  const category = modal.querySelector(".sxron-detail-content > span")?.textContent?.trim() || "";
  const price = parsePrice(modal.querySelector(".sxron-detail-price")?.textContent || "");
  const meta = Array.from(modal.querySelectorAll(".sxron-detail-meta span"));
  const city = (meta[0]?.textContent || "").replace(/^📍\s*/, "").trim();

  if (!name) return null;
  return { name, category, city, price };
}

async function resolveProduct(seed: ProductSeed): Promise<Product | null> {
  const candidates = await getProducts({
    search: seed.name,
    city: seed.city || undefined,
  });

  const normalizedName = seed.name.toLowerCase();
  const exact = candidates.filter((product) => product.name.trim().toLowerCase() === normalizedName);
  const pool = exact.length ? exact : candidates;

  return [...pool]
    .sort((left, right) => {
      const leftScore =
        (Number(left.price) === seed.price ? 8 : 0) +
        (String(left.category || "").toLowerCase() === seed.category.toLowerCase() ? 4 : 0) +
        (String(left.city && typeof left.city === "object" ? left.city.name : left.city || "").toLowerCase() === seed.city.toLowerCase() ? 2 : 0);
      const rightScore =
        (Number(right.price) === seed.price ? 8 : 0) +
        (String(right.category || "").toLowerCase() === seed.category.toLowerCase() ? 4 : 0) +
        (String(right.city && typeof right.city === "object" ? right.city.name : right.city || "").toLowerCase() === seed.city.toLowerCase() ? 2 : 0);
      return rightScore - leftScore;
    })[0] || null;
}

function SellerAvatar({ seller }: { seller: PublicSellerResponse["seller"] }) {
  const source = seller.avatar_url || "";
  const shape = seller.avatar_shape || "rounded";
  return (
    <div className={`public-seller-avatar public-seller-avatar--${shape}`}>
      {source.startsWith("data:image/") ? <img src={source} alt="" /> : initials(seller.display_name || seller.first_name || "SXRON")}
    </div>
  );
}

export default function PublicSellerProfile({ onOpenProduct }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<PublicSellerResponse | null>(null);

  useEffect(() => {
    async function openSeller(seed: ProductSeed) {
      setOpen(true);
      setLoading(true);
      setError("");
      setData(null);

      try {
        const product = await resolveProduct(seed);
        const sellerId = product?.created_by ?? product?.seller_id ?? null;
        if (!sellerId) {
          throw new Error("Не удалось определить продавца этого объявления.");
        }

        const result = await getPublicSellerProfile(sellerId);
        setData(result);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить профиль продавца.");
      } finally {
        setLoading(false);
      }
    }

    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest(".sxron-detail-actions .sxron-primary");
      if (!button || !button.textContent?.includes("Профиль продавца")) return;

      const modal = button.closest(".sxron-product-modal");
      if (!modal) return;

      const seed = extractProductSeed(modal);
      if (!seed) return;

      void openSeller(seed);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  const averageRating = data?.rating ?? null;
  const ratingLabel = averageRating == null ? "Новый продавец" : averageRating.toFixed(1);
  const listingCount = data?.seller.listings_count ?? data?.listings.length ?? 0;
  const cityName = data?.seller.city?.name || "Город не указан";
  const joined = data?.seller.created_at
    ? new Date(data.seller.created_at).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
    : "недавно";
  const banner = data?.seller.profile_banner || "aurora";

  const topListings = useMemo(() => data?.listings.slice(0, 12) || [], [data]);

  function close() {
    setOpen(false);
    closeUnderlyingSellerModal();
  }

  if (!open) return null;

  return (
    <div className="public-seller-backdrop" role="dialog" aria-modal="true" aria-label="Публичный профиль продавца">
      <section className="public-seller-page">
        <button className="public-seller-close" type="button" onClick={close} aria-label="Закрыть">×</button>

        {loading && (
          <div className="public-seller-loading">
            <div className="public-seller-loading-orb">S</div>
            <h2>Загружаем профиль продавца</h2>
            <p>Получаем данные профиля и объявления…</p>
            <div className="public-seller-loading-line"><i /></div>
          </div>
        )}

        {!loading && error && (
          <div className="public-seller-error-state">
            <div>!</div>
            <h2>Профиль не удалось загрузить</h2>
            <p>{error}</p>
            <button type="button" onClick={close}>Вернуться к объявлению</button>
          </div>
        )}

        {!loading && !error && data && (
          <>
            <div className={`public-seller-cover public-seller-cover--${banner}`}>
              <div className="public-seller-cover-glow public-seller-cover-glow--one" />
              <div className="public-seller-cover-glow public-seller-cover-glow--two" />
              <span className="public-seller-cover-mark">SXRON</span>
            </div>

            <div className="public-seller-head">
              <SellerAvatar seller={data.seller} />
              <div className="public-seller-head-main">
                <div className="public-seller-name-row">
                  <h1>{data.seller.display_name || data.seller.first_name || "Продавец SXRON"}</h1>
                  {data.seller.verified && data.seller.badges_visible !== false && <span className="public-seller-badge">✓ Проверен</span>}
                  {data.seller.activity_visible !== false && data.seller.is_online && <span className="public-seller-online">● Онлайн</span>}
                </div>
                {data.seller.username_visible !== false && data.seller.username && <div className="public-seller-username">@{data.seller.username}</div>}
                {data.seller.profile_status && <div className="public-seller-status">{data.seller.profile_status}</div>}
                <p className="public-seller-meta">📍 {cityName} · На SXRON с {joined}</p>
              </div>
            </div>

            {data.seller.bio && <p className="public-seller-bio">{data.seller.bio}</p>}

            <div className="public-seller-stats">
              <div><b>{listingCount}</b><span>Объявлений</span></div>
              <div><b>{ratingLabel}</b><span>Рейтинг</span></div>
              <div><b>{data.reviews_count}</b><span>Отзывов</span></div>
              <div><b>{data.seller.views_count ?? 0}</b><span>Просмотров</span></div>
            </div>

            <div className="public-seller-grid">
              <div className="public-seller-card public-seller-about">
                <div className="public-seller-card-head"><div><span>SELLER</span><h2>О продавце</h2></div></div>
                <div className="public-seller-about-list">
                  <div><span>🪪 ID</span><b>#{data.seller.id}</b></div>
                  <div><span>📍 Город</span><b>{cityName}</b></div>
                  <div><span>📦 Активных объявлений</span><b>{data.seller.active_listings_count ?? listingCount}</b></div>
                  <div><span>⭐ Рейтинг</span><b>{averageRating == null ? "Пока нет оценок" : `${averageRating.toFixed(1)} / 5`}</b></div>
                </div>
              </div>

              <div className="public-seller-card public-seller-reviews">
                <div className="public-seller-card-head"><div><span>REVIEWS</span><h2>Отзывы</h2></div></div>
                {data.reviews.length ? data.reviews.slice(0, 3).map((review) => (
                  <div className="public-seller-review" key={review.id}>
                    <div className="public-seller-review-top"><b>{review.author_name || "Пользователь"}</b><span>{"★".repeat(Math.max(0, Math.min(5, review.rating)))}</span></div>
                    <p>{review.text || "Без комментария"}</p>
                  </div>
                )) : (
                  <div className="public-seller-empty-review"><span>★</span><b>Отзывов пока нет</b><p>После первых завершённых сделок здесь появятся отзывы покупателей.</p></div>
                )}
              </div>
            </div>

            <section className="public-seller-listings">
              <div className="public-seller-listings-head"><div><span>MARKETPLACE</span><h2>Объявления продавца</h2><p>{topListings.length ? `Показано ${topListings.length} из ${listingCount}` : "Активных объявлений пока нет"}</p></div></div>
              {topListings.length ? (
                <div className="public-seller-product-grid">
                  {topListings.map((product) => (
                    <article className="public-seller-product" key={product.id} onClick={() => onOpenProduct?.(product)} role={onOpenProduct ? "button" : undefined} tabIndex={onOpenProduct ? 0 : undefined}>
                      <div className="public-seller-product-image">
                        {product.photo_url ? <img src={product.photo_url} alt={product.name} /> : <span>S</span>}
                      </div>
                      <div className="public-seller-product-body">
                        <span>{product.category || "Без категории"}</span>
                        <h3>{product.name}</h3>
                        <strong>{Number(product.price || 0).toLocaleString("ru-RU")} ₽</strong>
                        <small>📍 {typeof product.city === "string" ? product.city : product.city?.name || cityName}</small>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="public-seller-empty-list">У этого продавца пока нет активных объявлений.</div>
              )}
            </section>
          </>
        )}
      </section>
    </div>
  );
}
