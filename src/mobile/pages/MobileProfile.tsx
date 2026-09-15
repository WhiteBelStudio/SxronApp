import type { Product } from "../../types";

import MobileProductCard from "../components/MobileProductCard";

interface MobileProfileProps {
  products: Product[];
  onProduct?: (product: Product) => void;
  onCreate?: () => void;
}

interface TelegramUser {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

interface TelegramWebApp {
  initDataUnsafe?: {
    user?: TelegramUser;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

function getTelegramUser(): TelegramUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.Telegram?.WebApp?.initDataUnsafe?.user ??
    null
  );
}

function getInitials(
  firstName?: string,
  lastName?: string,
): string {
  const first = firstName?.trim()?.[0] ?? "";
  const last = lastName?.trim()?.[0] ?? "";

  const result = `${first}${last}`.toUpperCase();

  return result || "S";
}

function getDisplayName(
  firstName?: string,
  lastName?: string,
): string {
  const name = [
    firstName,
    lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || "Пользователь SXRON";
}

function formatDate(
  date?: string,
): string {
  if (!date) {
    return "—";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString(
    "ru-RU",
    {
      month: "long",
      year: "numeric",
    },
  );
}

export default function MobileProfile({
  products,
  onProduct,
  onCreate,
}: MobileProfileProps) {
  const telegramUser = getTelegramUser();

  const displayName = getDisplayName(
    telegramUser?.first_name,
    telegramUser?.last_name,
  );

  const username = telegramUser?.username
    ? `@${telegramUser.username}`
    : "username не указан";

  const initials = getInitials(
    telegramUser?.first_name,
    telegramUser?.last_name,
  );

  /*
   * Пока backend профиля не подключён,
   * реальные статистические значения не выдумываем.
   */
  const listingsCount = products.length;
  const activeListings = products.length;

  return (
    <main className="mobile-page">

      {/* =====================================================
          PROFILE HERO
          ===================================================== */}

      <section className="mobile-profile-hero">

        <div className="mobile-profile-hero__glow" />

        <div className="mobile-profile-hero__top">

          <div className="mobile-profile__avatar mobile-profile__avatar--large">

            {telegramUser?.photo_url ? (
              <img
                src={telegramUser.photo_url}
                alt={displayName}
              />
            ) : (
              <span>
                {initials}
              </span>
            )}

            <span className="mobile-profile__online-dot" />

          </div>

          <div className="mobile-profile-hero__identity">

            <div className="mobile-profile__name-row">

              <h1 className="mobile-profile__name">
                {displayName}
              </h1>

              <span className="mobile-profile__verified">
                ✓
              </span>

            </div>

            <div className="mobile-profile__username">
              {username}
            </div>

            <div className="mobile-profile__location">
              📍 Белореченск
            </div>

          </div>

        </div>

        <div className="mobile-profile__badges">

          <span className="mobile-profile__badge">
            🟢 Пользователь SXRON
          </span>

          <span className="mobile-profile__badge">
            ✨ Новый профиль
          </span>

        </div>

        <button
          className="mobile-create-button mobile-profile__create"
          type="button"
          onClick={onCreate}
        >
          <span>＋</span>
          Подать объявление
        </button>

      </section>


      {/* =====================================================
          STATISTICS
          ===================================================== */}

      <section className="mobile-profile-stats">

        <div className="mobile-profile-stat">

          <strong>
            {listingsCount}
          </strong>

          <span>
            Объявлений
          </span>

        </div>

        <div className="mobile-profile-stat">

          <strong>
            {activeListings}
          </strong>

          <span>
            Активных
          </span>

        </div>

        <div className="mobile-profile-stat">

          <strong>
            —
          </strong>

          <span>
            Продано
          </span>

        </div>

        <div className="mobile-profile-stat">

          <strong>
            —
          </strong>

          <span>
            Просмотров
          </span>

        </div>

      </section>


      {/* =====================================================
          ABOUT
          ===================================================== */}

      <section className="mobile-profile-section">

        <div className="mobile-profile-section__title">
          <div>
            <h2>
              О пользователе
            </h2>

            <p>
              Информация профиля
            </p>
          </div>
        </div>

        <div className="mobile-profile-info">

          <div className="mobile-profile-info__row">

            <div className="mobile-profile-info__icon">
              👤
            </div>

            <div>
              <span>
                Имя
              </span>

              <strong>
                {displayName}
              </strong>
            </div>

          </div>


          <div className="mobile-profile-info__row">

            <div className="mobile-profile-info__icon">
              📱
            </div>

            <div>
              <span>
                Telegram
              </span>

              <strong>
                {username}
              </strong>
            </div>

          </div>


          <div className="mobile-profile-info__row">

            <div className="mobile-profile-info__icon">
              📍
            </div>

            <div>
              <span>
                Город
              </span>

              <strong>
                Белореченск
              </strong>
            </div>

          </div>


          <div className="mobile-profile-info__row">

            <div className="mobile-profile-info__icon">
              📅
            </div>

            <div>
              <span>
                На SXRON с
              </span>

              <strong>
                {formatDate(undefined)}
              </strong>
            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          SELLER RATING
          ===================================================== */}

      <section className="mobile-profile-rating">

        <div className="mobile-profile-rating__icon">
          ⭐
        </div>

        <div className="mobile-profile-rating__content">

          <div className="mobile-profile-rating__title">
            Рейтинг продавца
          </div>

          <div className="mobile-profile-rating__value">
            <strong>
              —
            </strong>

            <span>
              Пока нет отзывов
            </span>
          </div>

        </div>

        <div className="mobile-profile-rating__arrow">
          ›
        </div>

      </section>


      {/* =====================================================
          TRUST
          ===================================================== */}

      <section className="mobile-profile-section">

        <div className="mobile-profile-section__title">
          <div>
            <h2>
              Надёжность
            </h2>

            <p>
              Статус профиля
            </p>
          </div>
        </div>

        <div className="mobile-profile-trust">

          <div className="mobile-profile-trust__item">

            <div className="mobile-profile-trust__icon">
              ✓
            </div>

            <div>
              <strong>
                Telegram подтверждён
              </strong>

              <span>
                Аккаунт подключён через Telegram
              </span>
            </div>

          </div>


          <div className="mobile-profile-trust__item">

            <div className="mobile-profile-trust__icon">
              🏪
            </div>

            <div>
              <strong>
                Профиль SXRON
              </strong>

              <span>
                Используется для покупок и продаж
              </span>
            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          MY PRODUCTS
          ===================================================== */}

      <section className="mobile-section mobile-profile-products">

        <div className="mobile-section__header">

          <div>
            <h2>
              Мои объявления
            </h2>

            <p>
              Управляйте своими товарами
            </p>
          </div>

          <span className="mobile-profile-products__count">
            {products.length}
          </span>

        </div>


        {products.length > 0 ? (

          <div className="mobile-products">

            {products.map(
              (product) => (
                <MobileProductCard
                  key={product.id}
                  product={product}
                  onClick={onProduct}
                />
              ),
            )}

          </div>

        ) : (

          <div className="mobile-empty mobile-profile-empty">

            <div className="mobile-empty__icon">
              🛍️
            </div>

            <h3>
              Объявлений пока нет
            </h3>

            <p>
              Добавьте первое объявление,
              чтобы начать продавать на SXRON.
            </p>

            <button
              className="mobile-profile-empty__button"
              type="button"
              onClick={onCreate}
            >
              ＋ Добавить объявление
            </button>

          </div>

        )}

      </section>


      {/* =====================================================
          PROFILE ACTIONS
          ===================================================== */}

      <section className="mobile-profile-actions">

        <button
          type="button"
          className="mobile-profile-action"
        >
          <span className="mobile-profile-action__icon">
            ❤️
          </span>

          <span>
            Избранное
          </span>

          <b>
            ›
          </b>
        </button>


        <button
          type="button"
          className="mobile-profile-action"
        >
          <span className="mobile-profile-action__icon">
            💬
          </span>

          <span>
            Мои чаты
          </span>

          <b>
            ›
          </b>
        </button>


        <button
          type="button"
          className="mobile-profile-action"
        >
          <span className="mobile-profile-action__icon">
            ⚙️
          </span>

          <span>
            Настройки
          </span>

          <b>
            ›
          </b>
        </button>

      </section>

    </main>
  );
}
