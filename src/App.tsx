/// <reference types="vite/client" />
import { useEffect, useMemo, useState } from "react";
import type { City, Page, Product, ProfileCustomization } from "./types";
import { getAdmins, getCategories, getMe, getProducts, type AdminUser, type MeResponse } from "./api/api";
import "./styles/global.css";
import "./styles/profile.css";
import "./styles/marketplace.css";

const DEFAULT_PROFILE: ProfileCustomization = {
  displayName: "",
  bio: "",
  avatar: "✦",
  accent: "cyan",
  usernameVisible: true,
  badgesVisible: true,
};

function loadProfile(): ProfileCustomization {
  try {
    const raw = localStorage.getItem("sxron_profile_customization");
    return raw ? { ...DEFAULT_PROFILE, ...JSON.parse(raw) } : DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

function loadFavorites(): number[] {
  try {
    return JSON.parse(localStorage.getItem("sxron_favorites") || "[]");
  } catch {
    return [];
  }
}

function saveFavorites(ids: number[]) {
  try { localStorage.setItem("sxron_favorites", JSON.stringify(ids)); } catch { /* ignore */ }
}

function normalizeProduct(product: Product): Product {
  return {
    ...product,
    price: Number(product.price) || 0,
    description: product.description || "Описание отсутствует.",
  };
}

function productCity(product: Product) {
  return typeof product.city === "string" ? product.city : product.city?.name || "Белореченск";
}

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= 768);
  const [city] = useState<City>({ id: 1, name: "Белореченск" });
  const [profile] = useState<ProfileCustomization>(() => loadProfile());
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string; slug?: string; icon?: string }[]>([]);
  const [favorites, setFavorites] = useState<number[]>(() => loadFavorites());
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sellerProduct, setSellerProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [adminId, setAdminId] = useState("");
  const [manageMode, setManageMode] = useState<"list" | "create" | "edit">("list");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const resize = () => setIsMobile(window.innerWidth <= 768);
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    try { localStorage.setItem("sxron_profile_customization", JSON.stringify(profile)); } catch { /* ignore */ }
    document.documentElement.dataset.sxronAccent = profile.accent;
  }, [profile]);

  useEffect(() => saveFavorites(favorites), [favorites]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [productData, categoryData] = await Promise.all([
          getProducts({ city: city.name }),
          getCategories(),
        ]);
        if (!alive) return;
        setProducts(productData.map(normalizeProduct));
        setCategories(categoryData);
        setApiError("");
      } catch (error) {
        if (!alive) return;
        setApiError(error instanceof Error ? error.message : "Не удалось загрузить каталог.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [city.name]);

  useEffect(() => {
    getMe().then(setMe).catch(() => setMe(null));
  }, []);

  useEffect(() => {
    if (!me?.is_admin) return;
    getAdmins().then((result) => setAdmins(result.admins)).catch(() => undefined);
  }, [me?.is_admin]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const category = product.category || "Без категории";
      const categoryMatch = selectedCategory === "Все" || category === selectedCategory;
      const searchMatch = !query || `${product.name} ${product.description} ${category} ${productCity(product)}`.toLowerCase().includes(query);
      return categoryMatch && searchMatch;
    });
  }, [products, search, selectedCategory]);

  const favoriteProducts = products.filter((product) => favorites.includes(product.id));
  const managedProducts = products.filter((product) => Boolean(product.created_by && me?.user.id === product.created_by));

  function navigate(next: Page) {
    setPage(next);
    setSelectedProduct(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleFavorite(id: number) {
    setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function handleLocalProductSave(product: Product) {
    const normalized = normalizeProduct(product);
    setProducts((current) => {
      const exists = current.some((item) => item.id === normalized.id);
      return exists ? current.map((item) => item.id === normalized.id ? normalized : item) : [normalized, ...current];
    });
    setEditingProduct(null);
    setManageMode("list");
    notify("Объявление сохранено");
  }

  function handleDeleteProduct(id: number) {
    setProducts((current) => current.filter((product) => product.id !== id));
    setFavorites((current) => current.filter((item) => item !== id));
    setSelectedProduct(null);
    notify("Объявление удалено");
  }

  const appClass = isMobile ? "sxron-shell sxron-shell--mobile" : "sxron-shell";

  return (
    <div className={appClass}>
      <header className="sxron-topbar">
        <button className="sxron-brand" onClick={() => navigate("home")} aria-label="SXRON">
          <span className="sxron-brand__mark">S</span>
          <span>SXRON</span>
        </button>
        {!isMobile && (
          <nav className="sxron-topnav">
            <button className={page === "home" ? "active" : ""} onClick={() => navigate("home")}>Главная</button>
            <button className={page === "catalog" ? "active" : ""} onClick={() => navigate("catalog")}>Каталог</button>
            <button className={page === "favorites" ? "active" : ""} onClick={() => navigate("favorites")}>Избранное</button>
            {me?.is_admin && <button className={page === "profile" ? "active" : ""} onClick={() => navigate("profile")}>Админ</button>}
          </nav>
        )}
        <div className="sxron-city-pill">📍 {city.name}</div>
      </header>

      <main className="sxron-content">
        {page === "home" && (
          <section className="sxron-home">
            <div className="sxron-hero-card">
              <div>
                <span className="sxron-kicker">SXRON MARKETPLACE</span>
                <h1>Покупай.<br /><span>Продавай.</span></h1>
                <p>Современный маркетплейс Белореченска. Найди нужное или размести своё объявление.</p>
                <div className="sxron-actions">
                  <button className="sxron-primary" onClick={() => navigate("catalog")}>🛍 Открыть каталог</button>
                  <button className="sxron-secondary" onClick={() => { setManageMode("create"); navigate("profile"); }}>＋ Продать</button>
                </div>
              </div>
              <div className="sxron-hero-orb"><span>S</span></div>
            </div>

            <div className="sxron-section-head"><div><span>КАТЕГОРИИ</span><h2>Что ищем?</h2></div><button onClick={() => navigate("catalog")}>Все →</button></div>
            <div className="sxron-category-grid">
              {categories.slice(0, 8).map((category) => (
                <button key={category.id} className="sxron-category-card" onClick={() => { setSelectedCategory(category.name); navigate("catalog"); }}>
                  <strong>{category.icon || "◈"}</strong><span>{category.name}</span>
                </button>
              ))}
            </div>

            <div className="sxron-section-head"><div><span>ПОСЛЕДНИЕ</span><h2>Новые объявления</h2></div><button onClick={() => navigate("catalog")}>Смотреть все →</button></div>
            <ProductGrid products={products.slice(0, 6)} favorites={favorites} onFavorite={toggleFavorite} onProduct={setSelectedProduct} onSeller={setSellerProduct} />
          </section>
        )}

        {page === "catalog" && (
          <section className="sxron-page">
            <div className="sxron-page-head"><div><span>MARKETPLACE</span><h1>Каталог</h1><p>{filteredProducts.length} объявлений</p></div></div>
            <div className="sxron-searchbar"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск товаров и объявлений..." /><button onClick={() => { setSearch(""); setSelectedCategory("Все"); }}>Сбросить</button></div>
            <div className="sxron-filter-scroll"><button className={selectedCategory === "Все" ? "active" : ""} onClick={() => setSelectedCategory("Все")}>Все</button>{categories.map((category) => <button key={category.id} className={selectedCategory === category.name ? "active" : ""} onClick={() => setSelectedCategory(category.name)}>{category.icon || "◈"} {category.name}</button>)}</div>
            {loading ? <LoadingGrid /> : apiError ? <EmptyState title="Каталог пока не подключён" text={apiError} action="Повторить" onAction={() => window.location.reload()} /> : <ProductGrid products={filteredProducts} favorites={favorites} onFavorite={toggleFavorite} onProduct={setSelectedProduct} onSeller={setSellerProduct} />}
          </section>
        )}

        {page === "favorites" && (
          <section className="sxron-page"><div className="sxron-page-head"><div><span>YOUR LIST</span><h1>Избранное</h1><p>{favoriteProducts.length} товаров</p></div></div>{favoriteProducts.length ? <ProductGrid products={favoriteProducts} favorites={favorites} onFavorite={toggleFavorite} onProduct={setSelectedProduct} onSeller={setSellerProduct} /> : <EmptyState title="Здесь пока пусто" text="Нажимай ♡ на понравившихся товарах — они появятся здесь." action="Перейти в каталог" onAction={() => navigate("catalog")} />}</section>
        )}

        {page === "profile" && (
          <section className="sxron-page"><div className="sxron-profile-banner"><div className="sxron-avatar">{profile.avatar.startsWith("data:image/") ? <img src={profile.avatar} alt="" /> : profile.avatar}</div><div><span>УПРАВЛЕНИЕ</span><h1>{profile.displayName || me?.user.first_name || "Мой профиль"}</h1><p>{me?.is_owner ? "Владелец SXRON" : me?.is_admin ? "Администратор" : "Профиль продавца"}</p></div></div>
            {me?.is_admin && <div className="sxron-admin-card"><div className="sxron-card-head"><div><span>ADMIN</span><h2>Админ-раздел</h2></div><span className="sxron-status">● ONLINE</span></div><div className="sxron-admin-stats"><div><b>{products.length}</b><span>Товаров</span></div><div><b>{favorites.length}</b><span>Избранных</span></div><div><b>{admins.length}</b><span>Админов</span></div></div>{me.is_owner && <div className="sxron-admin-manage"><input value={adminId} onChange={(event) => setAdminId(event.target.value)} placeholder="Telegram ID администратора" /><button onClick={() => { const id = Number(adminId); if (!id) return notify("Введите корректный Telegram ID"); notify("Запрос на добавление подготовлен"); setAdminId(""); }}>Добавить</button></div>}{admins.length > 0 && <div className="sxron-admin-list">{admins.map((admin) => <div key={admin.id}><span>{admin.first_name || "Пользователь"} {admin.username ? `@${admin.username}` : ""}</span><b>{admin.role === "owner" ? "OWNER" : "ADMIN"}</b></div>)}</div>}</div>}
            <div className="sxron-manage-card"><div className="sxron-card-head"><div><span>SELLER</span><h2>Мои объявления</h2></div><button className="sxron-primary sxron-small" onClick={() => { setEditingProduct(null); setManageMode("create"); }}>＋ Добавить</button></div>{manageMode === "create" || manageMode === "edit" ? <ProductEditor product={editingProduct} userId={me?.user.id || 0} onCancel={() => { setManageMode("list"); setEditingProduct(null); }} onSave={handleLocalProductSave} /> : <div className="sxron-manage-list">{managedProducts.length ? managedProducts.map((product) => <div className="sxron-manage-row" key={product.id}><div><b>{product.name}</b><span>{product.price.toLocaleString("ru-RU")} ₽ · {productCity(product)}</span></div><div><button onClick={() => { setEditingProduct(product); setManageMode("edit"); }}>✎</button><button onClick={() => handleDeleteProduct(product.id)}>⌫</button></div></div>) : <p className="sxron-muted">Ваши объявления появятся здесь.</p>}</div>}</div>
          </section>
        )}
      </main>

      <nav className="sxron-bottom-nav"><button className={page === "home" ? "active" : ""} onClick={() => navigate("home")}><b>⌂</b><span>Главная</span></button><button className={page === "catalog" ? "active" : ""} onClick={() => navigate("catalog")}><b>⌕</b><span>Каталог</span></button><button className={page === "favorites" ? "active" : ""} onClick={() => navigate("favorites")}><b>♡</b><span>Избранное</span></button><button className={page === "profile" ? "active" : ""} onClick={() => navigate("profile")}><b>◉</b><span>Профиль</span></button></nav>

      {selectedProduct && <ProductModal product={selectedProduct} favorite={favorites.includes(selectedProduct.id)} onFavorite={() => toggleFavorite(selectedProduct.id)} onClose={() => setSelectedProduct(null)} onSeller={() => setSellerProduct(selectedProduct)} />}
      {sellerProduct && <SellerModal product={sellerProduct} onClose={() => setSellerProduct(null)} />}
      {toast && <div className="sxron-toast">✓ {toast}</div>}
    </div>
  );
}

function ProductGrid({ products, favorites, onFavorite, onProduct, onSeller }: { products: Product[]; favorites: number[]; onFavorite: (id: number) => void; onProduct: (product: Product) => void; onSeller: (product: Product) => void }) {
  if (!products.length) return <EmptyState title="Ничего не найдено" text="Попробуй изменить запрос или категорию." />;
  return <div className="sxron-product-grid">{products.map((product) => <article className="sxron-product-card" key={product.id} onClick={() => onProduct(product)}><div className="sxron-product-image">{product.photo_url ? <img src={product.photo_url} alt={product.name} /> : <span>S</span>}<button onClick={(event) => { event.stopPropagation(); onFavorite(product.id); }} className={favorites.includes(product.id) ? "liked" : ""}>{favorites.includes(product.id) ? "♥" : "♡"}</button></div><div className="sxron-product-body"><span>{product.category || "Без категории"}</span><h3>{product.name}</h3><strong>{product.price.toLocaleString("ru-RU")} ₽</strong><small>📍 {productCity(product)} · <button onClick={(event) => { event.stopPropagation(); onSeller(product); }}>Продавец</button></small></div></article>)}</div>;
}

function ProductModal({ product, favorite, onFavorite, onClose, onSeller }: { product: Product; favorite: boolean; onFavorite: () => void; onClose: () => void; onSeller: () => void }) {
  return <div className="sxron-modal-backdrop" onClick={onClose}><div className="sxron-modal sxron-product-modal" onClick={(event) => event.stopPropagation()}><button className="sxron-modal-close" onClick={onClose}>×</button><div className="sxron-detail-image">{product.photo_url ? <img src={product.photo_url} alt={product.name} /> : <span>S</span>}</div><div className="sxron-detail-content"><span>{product.category || "Без категории"}</span><h2>{product.name}</h2><strong className="sxron-detail-price">{product.price.toLocaleString("ru-RU")} ₽</strong><p>{product.description}</p><div className="sxron-detail-meta"><span>📍 {productCity(product)}</span>{product.condition && <span>◈ {product.condition}</span>}{product.delivery && <span>🚚 {product.delivery}</span>}</div><div className="sxron-detail-actions"><button className="sxron-primary" onClick={onSeller}>👤 Профиль продавца</button><button className="sxron-secondary" onClick={onFavorite}>{favorite ? "♥ В избранном" : "♡ В избранное"}</button></div></div></div></div>;
}

function SellerModal({ product, onClose }: { product: Product; onClose: () => void }) {
  return <div className="sxron-modal-backdrop" onClick={onClose}><div className="sxron-modal sxron-seller-modal" onClick={(event) => event.stopPropagation()}><button className="sxron-modal-close" onClick={onClose}>×</button><div className="sxron-seller-avatar">{(product.name || "S").charAt(0).toUpperCase()}</div><span>ПРОДАВЕЦ</span><h2>Продавец SXRON</h2><div className="sxron-rating">★★★★★ <b>Новый профиль</b></div><p>Профиль продавца и его объявления будут загружаться из SXRON API.</p><div className="sxron-seller-stats"><div><b>—</b><span>Рейтинг</span></div><div><b>—</b><span>Отзывы</span></div><div><b>—</b><span>Объявления</span></div></div><button className="sxron-primary">💬 Написать продавцу</button></div></div>;
}

function ProductEditor({ product, userId, onCancel, onSave }: { product: Product | null; userId: number; onCancel: () => void; onSave: (product: Product) => void }) {
  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [price, setPrice] = useState(String(product?.price || ""));
  const [category, setCategory] = useState(product?.category || "");
  const [city, setCity] = useState(productCity(product || { city: "Белореченск" } as Product));
  return <div className="sxron-editor"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" /><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание" /><input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="Цена, ₽" /><div className="sxron-editor-row"><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Категория" /><input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Город" /></div><div className="sxron-editor-actions"><button className="sxron-secondary" onClick={onCancel}>Отмена</button><button className="sxron-primary" onClick={() => { if (!name.trim() || !Number(price)) return; onSave({ ...(product || {} as Product), id: product?.id || Date.now(), name: name.trim(), description: description.trim(), price: Number(price.replace(/\s/g, "").replace(",", ".")), category: category.trim() || "Без категории", city, created_by: userId, available: true }); }}>Сохранить</button></div></div>;
}

function LoadingGrid() { return <div className="sxron-product-grid">{Array.from({ length: 6 }).map((_, index) => <div className="sxron-skeleton" key={index}><div /><span /><span /></div>)}</div>; }

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action?: string; onAction?: () => void }) { return <div className="sxron-empty"><div>◈</div><h2>{title}</h2><p>{text}</p>{action && <button className="sxron-primary" onClick={onAction}>{action}</button>}</div>; }
