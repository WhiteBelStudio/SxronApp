import { useState } from "react";
import type { Product, ProfileCustomization } from "../../types";
import MobileProductCard from "../components/MobileProductCard";
import ProfileCustomizer from "../../components/ProfileCustomizer";

interface MobileProfileProps {
  products: Product[];
  profile: ProfileCustomization;
  onProfileChange: (profile: ProfileCustomization) => void;
  onProduct?: (product: Product) => void;
  onCreate?: () => void;
}
interface TelegramUser { id?: number; first_name?: string; last_name?: string; username?: string; photo_url?: string; }
interface TelegramWebApp { initDataUnsafe?: { user?: TelegramUser } }
declare global { interface Window { Telegram?: { WebApp?: TelegramWebApp } } }

function getTelegramUser(): TelegramUser | null { if (typeof window === "undefined") return null; return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null; }
function getInitials(firstName?: string, lastName?: string) { return `${firstName?.trim()?.[0] ?? ""}${lastName?.trim()?.[0] ?? ""}`.toUpperCase() || "S"; }
function getTelegramName(user: TelegramUser | null) { return [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || "Пользователь SXRON"; }
function isImageAvatar(value: string) { return value.startsWith("data:image/"); }

export default function MobileProfile({ products, profile, onProfileChange, onProduct, onCreate }: MobileProfileProps) {
  const telegramUser = getTelegramUser();
  const telegramName = getTelegramName(telegramUser);
  const displayName = profile.displayName.trim() || telegramName;
  const username = telegramUser?.username ? `@${telegramUser.username}` : "username не указан";
  const [customizing, setCustomizing] = useState(false);
  const avatar = isImageAvatar(profile.avatar) ? profile.avatar : null;

  return <main className="mobile-page">
    <section className={`mobile-profile-hero mobile-profile-hero--${profile.accent}`}>
      <div className="mobile-profile-hero__glow" />
      <div className="mobile-profile-hero__top">
        <div className="mobile-profile__avatar mobile-profile__avatar--large">
          {avatar ? <img src={avatar} alt={displayName} /> : telegramUser?.photo_url ? <img src={telegramUser.photo_url} alt={displayName} /> : <span>{profile.avatar || getInitials(telegramUser?.first_name, telegramUser?.last_name)}</span>}
          <span className="mobile-profile__online-dot" />
        </div>
        <div className="mobile-profile-hero__identity">
          <div className="mobile-profile__name-row"><h1 className="mobile-profile__name">{displayName}</h1><span className="mobile-profile__verified">✓</span></div>
          {profile.usernameVisible && <div className="mobile-profile__username">{username}</div>}
          <div className="mobile-profile__location">📍 Белореченск</div>
        </div>
      </div>
      {profile.bio && <p className="mobile-profile__bio">{profile.bio}</p>}
      {profile.badgesVisible && <div className="mobile-profile__badges"><span className="mobile-profile__badge">🟢 Пользователь</span><span className="mobile-profile__badge">✦ SXRON</span></div>}
      <button className="mobile-create-button mobile-profile__create" type="button" onClick={onCreate}><span>＋</span> Подать объявление</button>
      <button className="mobile-profile-edit" type="button" onClick={() => setCustomizing(true)}>✦ Настроить профиль <b>→</b></button>
    </section>

    <section className="mobile-profile-stats">
      <div className="mobile-profile-stat"><strong>{products.length}</strong><span>Объявлений</span></div>
      <div className="mobile-profile-stat"><strong>{products.length}</strong><span>Активных</span></div>
      <div className="mobile-profile-stat"><strong>—</strong><span>Продано</span></div>
      <div className="mobile-profile-stat"><strong>—</strong><span>Просмотров</span></div>
    </section>

    <section className="mobile-profile-section">
      <div className="mobile-profile-section__title"><div><h2>О пользователе</h2><p>Информация профиля</p></div></div>
      <div className="mobile-profile-info">
        <div className="mobile-profile-info__row"><div className="mobile-profile-info__icon">👤</div><div><span>Имя</span><strong>{displayName}</strong></div></div>
        {profile.usernameVisible && <div className="mobile-profile-info__row"><div className="mobile-profile-info__icon">📱</div><div><span>Telegram</span><strong>{username}</strong></div></div>}
        <div className="mobile-profile-info__row"><div className="mobile-profile-info__icon">📍</div><div><span>Город</span><strong>Белореченск</strong></div></div>
        <div className="mobile-profile-info__row"><div className="mobile-profile-info__icon">✨</div><div><span>Описание</span><strong>{profile.bio || "Не заполнено"}</strong></div></div>
      </div>
    </section>

    <section className="mobile-profile-rating"><div className="mobile-profile-rating__icon">⭐</div><div className="mobile-profile-rating__content"><div className="mobile-profile-rating__title">Рейтинг продавца</div><div className="mobile-profile-rating__value"><strong>—</strong><span>Пока нет отзывов</span></div></div><div className="mobile-profile-rating__arrow">›</div></section>

    <section className="mobile-profile-section"><div className="mobile-profile-section__title"><div><h2>Надёжность</h2><p>Статус профиля</p></div></div><div className="mobile-profile-trust">
      <div className="mobile-profile-trust__item"><div className="mobile-profile-trust__icon">✓</div><div><strong>Telegram подтверждён</strong><span>Аккаунт подключён через Telegram</span></div></div>
      <div className="mobile-profile-trust__item"><div className="mobile-profile-trust__icon">🏪</div><div><strong>Профиль SXRON</strong><span>Используется для покупок и продаж</span></div></div>
    </div></section>

    <section className="mobile-section mobile-profile-products"><div className="mobile-section__header"><div><h2>Мои объявления</h2><p>Управляйте своими товарами</p></div><span className="mobile-profile-products__count">{products.length}</span></div>
      {products.length ? <div className="mobile-products">{products.map((product) => <MobileProductCard key={product.id} product={product} onClick={onProduct} />)}</div> : <div className="mobile-empty mobile-profile-empty"><div className="mobile-empty__icon">🛍️</div><h3>Объявлений пока нет</h3><p>Добавьте первое объявление, чтобы начать продавать на SXRON.</p><button className="mobile-profile-empty__button" type="button" onClick={onCreate}>＋ Добавить объявление</button></div>}
    </section>

    <section className="mobile-profile-actions">
      <button type="button" className="mobile-profile-action"><span className="mobile-profile-action__icon">❤️</span><span>Избранное</span><b>›</b></button>
      <button type="button" className="mobile-profile-action"><span className="mobile-profile-action__icon">💬</span><span>Мои чаты</span><b>›</b></button>
      <button type="button" className="mobile-profile-action" onClick={() => setCustomizing(true)}><span className="mobile-profile-action__icon">✦</span><span>Настроить профиль</span><b>›</b></button>
    </section>

    {customizing && <ProfileCustomizer value={profile} telegramName={telegramName} onChange={onProfileChange} onClose={() => setCustomizing(false)} />}
  </main>;
}
