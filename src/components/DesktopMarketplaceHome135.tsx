import { useMemo } from "react";
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  Clock3,
  Grid2X2,
  Heart,
  Home,
  MapPin,
  MessageSquare,
  Package,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
  UserRound,
  WalletCards,
} from "lucide-react";
import type { City, Page, Product } from "../types";

type Category = { id: number; name: string; slug?: string; icon?: string };
type MeLike = { user?: { first_name?: string | null; username?: string | null; avatar_url?: string | null } | null; is_admin?: boolean; is_owner?: boolean } | null;

const categoryIcons: Record<string, typeof Grid2X2> = {
  "Электроника": Package,
  "Одежда": ShoppingBag,
  "Обувь": ShoppingBag,
  "Для дома": Home,
  "Дом": Home,
  "Авто": Truck,
  "Транспорт": Truck,
  "Спорт": BadgeCheck,
  "Другое": Grid2X2,
  "Разное": Grid2X2,
  "Игры": Grid2X2,
};

function cityName(product: Product): string {
  return typeof product.city === "string" ? product.city : product.city?.name || "Белореченск";
}

function money(value: number): string {
  return Number(value || 0).toLocaleString("ru-RU") + " ₽";
}

function ProductVisual({ product }: { product: Product }) {
  const src = product.photo_url || product.photo_file_id || "";
  if (src) return <img src={src} alt="" loading="lazy" />;
  return <div className="sx135-product-fallback"><Package size={54} strokeWidth={1.5} /></div>;
}

export default function DesktopMarketplaceHome({
  city,
  categories,
  products,
  favorites,
  me,
  search,
  selectedCategory,
  updateAvailable,
  onSearch,
  onCategory,
  onFavorite,
  onProduct,
  navigate,
  notify,
}: {
  city: City;
  categories: Category[];
  products: Product[];
  favorites: number[];
  me: MeLike;
  search: string;
  selectedCategory: string;
  updateAvailable: boolean;
  onSearch: (value: string) => void;
  onCategory: (value: string) => void;
  onFavorite: (id: number) => void;
  onProduct: (product: Product) => void;
  navigate: (page: Page) => void;
  notify: (message: string) => void;
}) {
  const displayProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((product) => {
        const category = product.category || "Другое";
        const haystack = (product.name + " " + (product.description || "") + " " + category + " " + cityName(product)).toLowerCase();
        return (!selectedCategory || selectedCategory === "Все" || category === selectedCategory) && (!q || haystack.includes(q));
      })
      .slice(0, 8);
  }, [products, search, selectedCategory]);

  const displayCategories = categories.length
    ? categories.slice(0, 7)
    : [
        { id: 1, name: "Электроника" },
        { id: 2, name: "Одежда" },
        { id: 3, name: "Обувь" },
        { id: 4, name: "Для дома" },
        { id: 5, name: "Авто" },
        { id: 6, name: "Спорт" },
        { id: 7, name: "Другое" },
      ];

  const userName = me?.user?.first_name || "Пользователь";
  const avatar = me?.user?.avatar_url;

  const nav = [
    { label: "Главная", icon: Home, page: "home" as Page },
    { label: "Категории", icon: Grid2X2, page: "catalog" as Page },
    { label: "Поиск", icon: Search, action: () => document.querySelector<HTMLInputElement>(".sx135-search input")?.focus() },
    { label: "Избранное", icon: Heart, page: "favorites" as Page },
    { label: "Мои объявления", icon: Package, page: "profile" as Page },
    { label: "Сообщения", icon: MessageSquare, action: () => notify("Раздел сообщений готовится") },
    { label: "Уведомления", icon: Bell, action: () => notify("Уведомления появятся здесь") },
    { label: "Профиль", icon: UserRound, page: "profile" as Page },
    { label: "Настройки", icon: Settings, page: "profile" as Page },
  ];

  return (
    <section className="sx135-home">
      <header className="sx135-header">
        <button className="sx135-brand" onClick={() => navigate("home")} aria-label="СХРОН">
          <img src="/sxron-logo.svg" alt="" />
          <span className="sx135-brand-word">СХРОН</span>
        </button>

        <label className="sx135-search">
          <Search size={21} />
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Поиск товаров, категорий, продавцов..." />
          <SlidersHorizontal size={18} />
        </label>

        <div className="sx135-header-actions">
          <button onClick={() => notify("Уведомления появятся здесь")} aria-label="Уведомления"><Bell size={22} />{updateAvailable && <i />}</button>
          <button onClick={() => notify("Сообщения появятся здесь")} aria-label="Сообщения"><MessageSquare size={22} /></button>
          <button className="sx135-user-chip" onClick={() => navigate("profile")}>
            <span className="sx135-mini-avatar">{avatar ? <img src={avatar} alt="" /> : <UserRound size={18} />}</span>
            <span><b>{userName}</b><small><span className="sx135-online-dot" /> Онлайн</small></span>
          </button>
        </div>
      </header>

      <div className="sx135-layout">
        <aside className="sx135-sidebar">
          <nav>
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.label} className={item.page === "home" ? "active" : ""} onClick={() => item.action ? item.action() : item.page && navigate(item.page)}>
                  <Icon size={23} strokeWidth={item.page === "home" ? 2.2 : 1.75} />
                  <span>{item.label}</span>
                  {item.label === "Сообщения" && <em>3</em>}
                  {item.label === "Уведомления" && <em>2</em>}
                </button>
              );
            })}
          </nav>
          <div className="sx135-sidebar-promo">
            <img src="/sxron-logo.svg" alt="" />
            <strong>СХРОН</strong>
            <span>НАДЁЖНЫЙ МАРКЕТПЛЕЙС</span>
            <small>БЕЛОРЕЧЕНСК • ХУТОР КУБАНСКИЙ</small>
            <div className="sx135-promo-wave" />
          </div>
        </aside>

        <main className="sx135-main">
          <div className="sx135-hero">
            <div className="sx135-hero-lines" />
            <div className="sx135-hero-copy">
              <span className="sx135-eyebrow">СХРОН MARKETPLACE</span>
              <h1>НАДЁЖНЫЙ<br /><strong>МАРКЕТПЛЕЙС</strong></h1>
              <p>Покупай. Продавай. Общайся.<br />Всё, что тебе нужно — в одном месте.</p>
              <div className="sx135-hero-actions">
                <button className="sx135-gradient-btn" onClick={() => navigate("catalog")}>Открыть каталог <ChevronRight size={17} /></button>
                <button className="sx135-ghost-btn" onClick={() => navigate("profile")}><Plus size={17} /> Разместить объявление</button>
              </div>
            </div>
            <div className="sx135-hero-brand">
              <img src="/sxron-logo.svg" alt="" />
              <div className="sx135-hero-brand-word">СХРОН</div>
              <span>НАДЁЖНЫЙ МАРКЕТПЛЕЙС</span>
              <small>{city.name.toUpperCase()} • ХУТОР КУБАНСКИЙ</small>
            </div>
            <div className="sx135-dots"><b /><i /><i /></div>
            <button className="sx135-hero-next" onClick={() => navigate("catalog")} aria-label="Открыть каталог"><ChevronRight /></button>
          </div>

          <section className="sx135-categories">
            {displayCategories.map((category) => {
              const Icon = categoryIcons[category.name] || Grid2X2;
              return (
                <button key={category.id} className={selectedCategory === category.name ? "selected" : ""} onClick={() => { onCategory(category.name); navigate("catalog"); }}>
                  <Icon size={26} strokeWidth={1.8} />
                  <span>{category.name}</span>
                </button>
              );
            })}
          </section>

          <div className="sx135-section-title">
            <div><span>ПОПУЛЯРНЫЕ ОБЪЯВЛЕНИЯ</span><h2>Популярные объявления</h2></div>
            <button onClick={() => navigate("catalog")}>Смотреть все <ChevronRight size={16} /></button>
          </div>

          <section className="sx135-products">
            {displayProducts.length ? displayProducts.map((product) => {
              const liked = favorites.includes(product.id);
              return (
                <article className="sx135-product-card" key={product.id} onClick={() => onProduct(product)}>
                  <div className="sx135-product-media">
                    <ProductVisual product={product} />
                    <button className={liked ? "liked" : ""} onClick={(event) => { event.stopPropagation(); onFavorite(product.id); }} aria-label="Избранное">
                      <Heart size={18} fill={liked ? "currentColor" : "none"} />
                    </button>
                  </div>
                  <div className="sx135-product-info">
                    <span>{product.category || "Другое"}</span>
                    <h3>{product.name}</h3>
                    <strong>{money(product.price)}</strong>
                    <small><MapPin size={13} /> {cityName(product)}</small>
                  </div>
                </article>
              );
            }) : (
              <div className="sx135-empty-products">
                <Package size={34} />
                <b>Пока нет объявлений</b>
                <span>Первое объявление можно разместить прямо сейчас.</span>
                <button className="sx135-gradient-btn" onClick={() => navigate("profile")}><Plus size={16} /> Разместить объявление</button>
              </div>
            )}
          </section>

          <div className="sx135-safe">
            <div className="sx135-section-title"><div><span>БЕЗОПАСНЫЕ ПОКУПКИ</span><h2>Покупай с уверенностью</h2></div></div>
            <div className="sx135-safe-grid">
              <div><ShieldCheck size={26} /><span><b>Проверенные продавцы</b><small>Реальные аккаунты и профиль продавца</small></span></div>
              <div><WalletCards size={26} /><span><b>Защита сделок</b><small>Прозрачные условия оплаты</small></span></div>
              <div><Truck size={26} /><span><b>Отзывы и рейтинги</b><small>Смотри историю продавца</small></span></div>
            </div>
          </div>
        </main>

        <aside className="sx135-rightbar">
          <div className="sx135-balance">
            <WalletCards size={34} />
            <div><span>Ваш баланс</span><strong>0.00 ₽</strong></div>
            <button onClick={() => notify("Пополнение кошелька будет доступно позже")}>Пополнить</button>
          </div>
          <div className="sx135-quick-grid">
            <button onClick={() => navigate("profile")}><Plus size={25} /><b>Разместить<br />объявление</b></button>
            <button onClick={() => navigate("profile")}><Package size={25} /><b>Мои объявления</b></button>
            <button onClick={() => navigate("favorites")}><Heart size={25} /><b>Избранное</b></button>
            <button onClick={() => notify("Раздел сообщений готовится")}><MessageSquare size={25} /><b>Сообщения</b></button>
          </div>
          <div className="sx135-activity">
            <div className="sx135-activity-head"><h3>Последние действия</h3><button onClick={() => notify("История действий появится здесь")}>Все</button></div>
            {displayProducts.slice(0, 4).map((product, index) => (
              <button key={product.id} onClick={() => onProduct(product)}>
                <span className="sx135-activity-thumb"><ProductVisual product={product} /></span>
                <span><b>{product.name}</b><small>{index % 2 ? "Добавлено в избранное" : "Просмотр объявления"}</small></span>
                <time><Clock3 size={12} /> {index + 2} мин назад</time>
              </button>
            ))}
          </div>
          <div className="sx135-right-promo">
            <img src="/sxron-logo.svg" alt="" />
            <strong>СХРОН</strong>
            <span>БОЛЬШЕ, ЧЕМ ПРОСТО<br />МАРКЕТПЛЕЙС</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
