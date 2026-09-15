import {
  useMemo,
  useState,
} from "react";

import type {
  Product,
} from "../../types";

import {
  DesktopProductCard,
} from "../components/DesktopProductCard";

interface DesktopHomeProps {
  products?: Product[];
  onProduct?: (product: Product) => void;
  onCatalog?: () => void;
  onCreate?: () => void;
}

const categories = [
  {
    name: "Электроника",
    icon: "📱",
  },
  {
    name: "Одежда",
    icon: "👕",
  },
  {
    name: "Обувь",
    icon: "👟",
  },
  {
    name: "Авто",
    icon: "🚗",
  },
  {
    name: "Для дома",
    icon: "🏠",
  },
  {
    name: "Красота",
    icon: "✨",
  },
  {
    name: "Услуги",
    icon: "🛠️",
  },
  {
    name: "Другое",
    icon: "📦",
  },
];

export default function DesktopHome({
  products = [],
  onProduct,
  onCatalog,
  onCreate,
}: DesktopHomeProps) {
  const [search, setSearch] =
    useState("");

  const filteredProducts =
    useMemo(() => {
      const value =
        search
          .trim()
          .toLowerCase();

      if (!value) {
        return products.slice(
          0,
          8,
        );
      }

      return products
        .filter(
          (product) => {
            const text = [
              product.name,
              product.description,
              product.category,
              typeof product.city ===
              "string"
                ? product.city
                : product.city?.name,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return text.includes(value);
          },
        )
        .slice(0, 8);
    }, [products, search]);

  return (
    <main className="desktop-home">
      <section className="desktop-home__hero">
        <div className="desktop-home__glow desktop-home__glow--one" />
        <div className="desktop-home__glow desktop-home__glow--two" />

        <div className="desktop-home__hero-content">
          <div className="desktop-home__badge">
            <span>●</span>
            SXRON MARKETPLACE
          </div>

          <h1>
            Покупай.
            <br />
            Продавай.
            <br />
            <span>Находи.</span>
          </h1>

          <p>
            Локальный маркетплейс
            Белореченска и
            Хутора Кубанского.
          </p>

          <div className="desktop-home__search">
            <span className="desktop-home__search-icon">
              🔎
            </span>

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Что вы ищете?"
            />

            {search && (
              <button
                type="button"
                className="desktop-home__search-clear"
                onClick={() =>
                  setSearch("")
                }
              >
                ×
              </button>
            )}

            <button
              type="button"
              className="desktop-home__search-button"
              onClick={onCatalog}
            >
              Найти
            </button>
          </div>

          <div className="desktop-home__actions">
            <button
              type="button"
              className="desktop-home__primary-button"
              onClick={onCreate}
            >
              <span>＋</span>
              Подать объявление
            </button>

            <button
              type="button"
              className="desktop-home__secondary-button"
              onClick={onCatalog}
            >
              Смотреть объявления
              <span>→</span>
            </button>
          </div>
        </div>

        <div className="desktop-home__visual">
          <div className="desktop-home__visual-orbit desktop-home__visual-orbit--one" />
          <div className="desktop-home__visual-orbit desktop-home__visual-orbit--two" />

          <div className="desktop-home__visual-card desktop-home__visual-card--top">
            <span>🔥</span>
            Свежие объявления
          </div>

          <div className="desktop-home__logo-orb">
            <div className="desktop-home__logo-x">
              SX
            </div>

            <strong>RON</strong>
          </div>

          <div className="desktop-home__visual-card desktop-home__visual-card--bottom">
            <span>📍</span>
            Белореченск
          </div>
        </div>
      </section>

      <section className="desktop-home__section">
        <div className="desktop-home__section-heading">
          <div>
            <span className="desktop-home__eyebrow">
              КАТАЛОГ
            </span>

            <h2>
              Категории
            </h2>
          </div>

          <button
            type="button"
            onClick={onCatalog}
            className="desktop-home__link-button"
          >
            Все категории →
          </button>
        </div>

        <div className="desktop-home__categories">
          {categories.map(
            (category) => (
              <button
                type="button"
                key={category.name}
                className="desktop-home__category"
                onClick={onCatalog}
              >
                <span className="desktop-home__category-icon">
                  {category.icon}
                </span>

                <span>
                  {category.name}
                </span>

                <small>
                  Смотреть →
                </small>
              </button>
            ),
          )}
        </div>
      </section>

      <section className="desktop-home__section desktop-home__section--products">
        <div className="desktop-home__section-heading">
          <div>
            <span className="desktop-home__eyebrow">
              НОВИНКИ
            </span>

            <h2>
              Свежие объявления
            </h2>
          </div>

          <button
            type="button"
            onClick={onCatalog}
            className="desktop-home__link-button"
          >
            Смотреть все →
          </button>
        </div>

        {filteredProducts.length > 0 ? (
          <div className="desktop-home__products">
            {filteredProducts.map(
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
          <div className="desktop-home__empty">
            <div className="desktop-home__empty-icon">
              {search ? "🔎" : "📦"}
            </div>

            <h3>
              {search
                ? "Ничего не найдено"
                : "Пока нет объявлений"}
            </h3>

            <p>
              {search
                ? "Попробуйте изменить поисковый запрос."
                : "Будьте первым — разместите своё объявление."}
            </p>

            {!search && (
              <button
                type="button"
                onClick={onCreate}
                className="desktop-home__empty-button"
              >
                ＋ Подать объявление
              </button>
            )}
          </div>
        )}
      </section>

      <section className="desktop-home__banner">
        <div>
          <span>
            SXRON
          </span>

          <h2>
            Твой город.
            <br />
            Твои объявления.
          </h2>

          <p>
            Всё нужное — рядом.
          </p>
        </div>

        <button
          type="button"
          onClick={onCreate}
        >
          Разместить объявление
          <span>→</span>
        </button>
      </section>
    </main>
  );
}
