import type { Product } from "../../types";

import DesktopProductCard from "../components/DesktopProductCard";

interface DesktopProfileProps {
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

export default function DesktopProfile({
  products,
  onProduct,
  onCreate,
}: DesktopProfileProps) {
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

  return (
    <div className="desktop-main">

      <div className="desktop-profile">

        {/* ===================================================
            LEFT PROFILE CARD
            =================================================== */}

        <aside className="desktop-profile__card desktop-profile__card--expanded">

          <div className="desktop-profile__avatar desktop-profile__avatar--large">

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

            <span className="desktop-profile__online-dot" />

          </div>


          <div className="desktop-profile__name-row">

            <div className="desktop-profile__name">
              {displayName}
            </div>

            <span className="desktop-profile__verified">
              ✓
            </span>

          </div>


          <div className="desktop-profile__username">
            {username}
          </div>


          <div className="desktop-profile__location">
            📍 Белореченск
          </div>


          <div className="desktop-profile__badges">

            <span>
              🟢 Пользователь
            </span>

            <span>
              ✨ SXRON
            </span>

          </div>


          <button
            className="desktop-button desktop-button--primary desktop-profile__create"
            type="button"
            onClick={onCreate}
          >
            ＋ Подать объявление
          </button>


          {/* PROFILE MINI INFO */}

          <div className="desktop-profile__mini-info">

            <div>
              <span>
                Telegram
              </span>

              <strong>
                Подключён
              </strong>
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

        </aside>


        {/* ===================================================
            RIGHT CONTENT
            =================================================== */}

        <section className="desktop-profile__content">

          {/* HEADER */}

          <div className="desktop-section__header">

            <div>
              <h1 className="desktop-section__title">
                Мой профиль
              </h1>

              <p className="desktop-section__subtitle">
                Ваша информация и активность на SXRON
              </p>
            </div>

          </div>


          {/* =================================================
              STATISTICS
              ================================================= */}

          <div className="desktop-profile__stats desktop-profile__stats--wide">

            <div className="desktop-profile__stat">

              <strong>
                {products.length}
              </strong>

              <span>
                Объявлений
              </span>

            </div>


            <div className="desktop-profile__stat">

              <strong>
                {products.length}
              </strong>

              <span>
                Активных
              </span>

            </div>


            <div className="desktop-profile__stat">

              <strong>
                —
              </strong>

              <span>
                Продано
              </span>

            </div>


            <div className="desktop-profile__stat">

              <strong>
                —
              </strong>

              <span>
                Просмотров
              </span>

            </div>


            <div className="desktop-profile__stat">

              <strong>
                —
              </strong>

              <span>
                Рейтинг
              </span>

            </div>

          </div>


          {/* =================================================
              ABOUT
              ================================================= */}

          <div className="desktop-profile__section">

            <div className="desktop-profile__section-heading">

              <div>
                <h2>
                  О пользователе
                </h2>

                <p>
                  Основная информация
                </p>
              </div>

            </div>


            <div className="desktop-profile__info-grid">

              <div className="desktop-profile__info">

                <span className="desktop-profile__info-icon">
                  👤
                </span>

                <div>
                  <span>
                    Имя
                  </span>

                  <strong>
                    {displayName}
                  </strong>
                </div>

              </div>


              <div className="desktop-profile__info">

                <span className="desktop-profile__info-icon">
                  📱
                </span>

                <div>
                  <span>
                    Telegram
                  </span>

                  <strong>
                    {username}
                  </strong>
                </div>

              </div>


              <div className="desktop-profile__info">

                <span className="desktop-profile__info-icon">
                  📍
                </span>

                <div>
                  <span>
                    Город
                  </span>

                  <strong>
                    Белореченск
                  </strong>
                </div>

              </div>


              <div className="desktop-profile__info">

                <span className="desktop-profile__info-icon">
                  📅
                </span>

                <div>
                  <span>
                    Статус
                  </span>

                  <strong>
                    Пользователь SXRON
                  </strong>
                </div>

              </div>

            </div>

          </div>


          {/* =================================================
              RATING
              ================================================= */}

          <div className="desktop-profile__rating">

            <div className="desktop-profile__rating-icon">
              ⭐
            </div>

            <div className="desktop-profile__rating-content">

              <strong>
                Рейтинг продавца
              </strong>

              <span>
                Отзывов пока нет
              </span>

            </div>

            <div className="desktop-profile__rating-value">
              —
            </div>

          </div>


          {/* =================================================
              TRUST
              ================================================= */}

          <div className="desktop-profile__section">

            <div className="desktop-profile__section-heading">

              <div>
                <h2>
                  Надёжность профиля
                </h2>

                <p>
                  Основные статусы аккаунта
                </p>
              </div>

            </div>


            <div className="desktop-profile__trust">

              <div className="desktop-profile__trust-item">

                <div className="desktop-profile__trust-icon">
                  ✓
                </div>

                <div>
                  <strong>
                    Telegram подтверждён
                  </strong>

                  <span>
                    Профиль связан с Telegram
                  </span>
                </div>

              </div>


              <div className="desktop-profile__trust-item">

                <div className="desktop-profile__trust-icon">
                  🏪
                </div>

                <div>
                  <strong>
                    Профиль SXRON
                  </strong>

                  <span>
                    Можно использовать для размещения объявлений
                  </span>
                </div>

              </div>

            </div>

          </div>


          {/* =================================================
              PRODUCTS
              ================================================= */}

          <div className="desktop-profile__products">

            <div className="desktop-section__header">

              <div>
                <h2 className="desktop-section__title">
                  Мои объявления
                </h2>

                <p className="desktop-section__subtitle">
                  Управляйте своими товарами
                </p>
              </div>

              <span className="desktop-profile__products-count">
                {products.length}
              </span>

            </div>


            {products.length > 0 ? (

              <div className="desktop-products">

                {products.map(
                  (product) => (
                    <DesktopProductCard
                      key={product.id}
                      product={product}
                      onClick={onProduct}
                    />
                  ),
                )}

              </div>

            ) : (

              <div className="desktop-empty desktop-profile__empty">

                <div className="desktop-empty__icon">
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
                  className="desktop-button desktop-button--primary"
                  type="button"
                  onClick={onCreate}
                >
                  ＋ Добавить объявление
                </button>

              </div>

            )}

          </div>

        </section>

      </div>

    </div>
  );
}
