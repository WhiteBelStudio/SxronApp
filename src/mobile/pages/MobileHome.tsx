import {
  useMemo,
  useState,
} from "react";

import type {
  Product,
} from "../../types";

import {
  MobileProductCard,
} from "../components/MobileProductCard";

interface MobileHomeProps {
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
    name: "Дом",
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

export default function MobileHome({
  products = [],
  onProduct,
  onCatalog,
  onCreate,
}: MobileHomeProps) {
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
          6,
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
        .slice(0, 6);
    }, [products, search]);

  return (
    <main className="mobile-home">
      <section className="mobile-home__hero">
        <div className="mobile-home__hero-glow" />

        <div className="mobile-home__badge">
          <span />
          SXRON MARKETPLACE
        </div>

        <h1>
          Всё рядом.
          <br />
          Всё в <span>SXRON.</span>
        </h1>

        <p>
          Покупай и продавай
          в своём городе.
        </p>

        <div className="mobile-home__search">
          <span>
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
            placeholder="Что ищете?"
          />

          {search && (
            <button
              type="button"
              onClick={() =>
                setSearch("")
              }
            >
              ×
            </button>
          )}
        </div>

        <button
          type="button"
          className="mobile-home__create"
          onClick={onCreate}
        >
          <span>＋</span>
          Подать объявление
          <b>→</b>
        </button>
      </section>

      <section className="mobile-home__section">
        <div className="mobile-home__section-heading">
          <div>
            <span>
              КАТАЛОГ
            </span>

            <h2>
              Категории
            </h2>
          </div>

          <button
            type="button"
            onClick={onCatalog}
          >
            Все →
          </button>
        </div>

        <div className="mobile-home__categories">
          {categories.map(
            (category) => (
              <button
                type="button"
                key={category.name}
                className="mobile-home__category"
                onClick={onCatalog}
              >
                <span>
                  {category.icon}
                </span>

                <b>
                  {category.name}
                </b>
              </button>
            ),
          )}
        </div>
      </section>

      <section className="mobile-home__section">
        <div className="mobile-home__section-heading">
          <div>
            <span>
              НОВИНКИ
            </span>

            <h2>
              Свежие объявления
            </h2>
          </div>

          <button
            type="button"
            onClick={onCatalog}
          >
            Все →
          </button>
        </div>

        {filteredProducts.length > 0 ? (
          <div className="mobile-home__products">
            {filteredProducts.map(
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
          <div className="mobile-home__empty">
            <div>
              {search ? "🔎" : "📦"}
            </div>

            <h3>
              {search
                ? "Ничего не найдено"
                : "Пока пусто"}
            </h3>

            <p>
              {search
                ? "Попробуйте другой запрос."
                : "Разместите первое объявление."}
            </p>

            {!search && (
              <button
                type="button"
                onClick={onCreate}
              >
                ＋ Подать объявление
              </button>
            )}
          </div>
        )}
      </section>

      <section className="mobile-home__promo">
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
      </section>
    </main>
  );
}
