import { useState } from "react";
import type { Product, ProfileCustomization } from "../../types";
import DesktopProductCard from "../components/DesktopProductCard";
import ProfileCustomizer from "../../components/ProfileCustomizer";

interface DesktopProfileProps { products: Product[]; profile: ProfileCustomization; onProfileChange: (profile: ProfileCustomization) => void; onProduct?: (product: Product) => void; onCreate?: () => void; }
interface TelegramUser { id?: number; first_name?: string; last_name?: string; username?: string; photo_url?: string; }
interface TelegramWebApp { initDataUnsafe?: { user?: TelegramUser } }
declare global { interface Window { Telegram?: { WebApp?: TelegramWebApp } } }
function getTelegramUser(): TelegramUser | null { if (typeof window === "undefined") return null; return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null; }
function getInitials(first?: string, last?: string) { return `${first?.trim()?.[0] ?? ""}${last?.trim()?.[0] ?? ""}`.toUpperCase() || "S"; }
function getTelegramName(user: TelegramUser | null) { return [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || "Пользователь SXRON"; }

export default function DesktopProfile({ products, profile, onProfileChange, onProduct, onCreate }: DesktopProfileProps) {
  const telegramUser = getTelegramUser();
  const telegramName = getTelegramName(telegramUser);
  const displayName = profile.displayName.trim() || telegramName;
  const username = telegramUser?.username ? `@${telegramUser.username}` : "username не указан";
  const [customizing, setCustomizing] = useState(false);

  return <div className="desktop-main"><div className="desktop-profile">
    <aside className={`desktop-profile__card desktop-profile__card--expanded desktop-profile--${profile.accent}`}>
      <div className="desktop-profile__avatar desktop-profile__avatar--large">{telegramUser?.photo_url ? <img src={telegramUser.photo_url} alt={displayName} /> : <span>{profile.avatar || getInitials(telegramUser?.first_name, telegramUser?.last_name)}</span>}<span className="desktop-profile__online-dot" /></div>
      <div className="desktop-profile__name-row"><div className="desktop-profile__name">{displayName}</div><span className="desktop-profile__verified">✓</span></div>
      {profile.usernameVisible && <div className="desktop-profile__username">{username}</div>}
      <div className="desktop-profile__location">📍 Белореченск</div>
      {profile.bio && <p className="desktop-profile__bio">{profile.bio}</p>}
      {profile.badgesVisible && <div className="desktop-profile__badges"><span>🟢 Пользователь</span><span>✦ SXRON</span></div>}
      <button className="desktop-button desktop-button--primary desktop-profile__create" type="button" onClick={onCreate}>＋ Подать объявление</button>
      <button className="desktop-profile-edit" type="button" onClick={() => setCustomizing(true)}>✦ Настроить профиль <b>→</b></button>
      <div className="desktop-profile__mini-info"><div><span>Telegram</span><strong>Подключён</strong></div><div><span>Город</span><strong>Белореченск</strong></div></div>
    </aside>

    <section className="desktop-profile__content">
      <div className="desktop-section__header"><div><h1 className="desktop-section__title">Мой профиль</h1><p className="desktop-section__subtitle">Ваша информация и активность на SXRON</p></div><button className="desktop-button desktop-button--ghost desktop-profile-header-button" type="button" onClick={() => setCustomizing(true)}>✦ Настроить профиль</button></div>
      <div className="desktop-profile__stats desktop-profile__stats--wide"><div className="desktop-profile__stat"><strong>{products.length}</strong><span>Объявлений</span></div><div className="desktop-profile__stat"><strong>{products.length}</strong><span>Активных</span></div><div className="desktop-profile__stat"><strong>—</strong><span>Продано</span></div><div className="desktop-profile__stat"><strong>—</strong><span>Просмотров</span></div><div className="desktop-profile__stat"><strong>—</strong><span>Рейтинг</span></div></div>

      <div className="desktop-profile__section"><div className="desktop-profile__section-heading"><div><h2>О пользователе</h2><p>Основная информация</p></div></div><div className="desktop-profile__info-grid">
        <div className="desktop-profile__info"><span className="desktop-profile__info-icon">👤</span><div><span>Имя</span><strong>{displayName}</strong></div></div>
        {profile.usernameVisible && <div className="desktop-profile__info"><span className="desktop-profile__info-icon">📱</span><div><span>Telegram</span><strong>{username}</strong></div></div>}
        <div className="desktop-profile__info"><span className="desktop-profile__info-icon">📍</span><div><span>Город</span><strong>Белореченск</strong></div></div>
        <div className="desktop-profile__info"><span className="desktop-profile__info-icon">✦</span><div><span>О себе</span><strong>{profile.bio || "Не заполнено"}</strong></div></div>
      </div></div>

      <div className="desktop-profile__rating"><div className="desktop-profile__rating-icon">⭐</div><div className="desktop-profile__rating-content"><strong>Рейтинг продавца</strong><span>Отзывов пока нет</span></div><div className="desktop-profile__rating-value">—</div></div>
      <div className="desktop-profile__section"><div className="desktop-profile__section-heading"><div><h2>Надёжность профиля</h2><p>Основные статусы аккаунта</p></div></div><div className="desktop-profile__trust"><div className="desktop-profile__trust-item"><div className="desktop-profile__trust-icon">✓</div><div><strong>Telegram подтверждён</strong><span>Профиль связан с Telegram</span></div></div><div className="desktop-profile__trust-item"><div className="desktop-profile__trust-icon">🏪</div><div><strong>Профиль SXRON</strong><span>Можно использовать для размещения объявлений</span></div></div></div></div>

      <div className="desktop-profile__products"><div className="desktop-section__header"><div><h2 className="desktop-section__title">Мои объявления</h2><p className="desktop-section__subtitle">Управляйте своими товарами</p></div><span className="desktop-profile__products-count">{products.length}</span></div>{products.length ? <div className="desktop-products">{products.map((product) => <DesktopProductCard key={product.id} product={product} onClick={onProduct} />)}</div> : <div className="desktop-empty desktop-profile__empty"><div className="desktop-empty__icon">🛍️</div><h3>Объявлений пока нет</h3><p>Добавьте первое объявление, чтобы начать продавать на SXRON.</p><button className="desktop-button desktop-button--primary" type="button" onClick={onCreate}>＋ Добавить объявление</button></div>}</div>
    </section>
    {customizing && <ProfileCustomizer value={profile} telegramName={telegramName} onChange={onProfileChange} onClose={() => setCustomizing(false)} />}
  </div></div>;
}
