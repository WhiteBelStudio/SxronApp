import type { Product } from "../../types";
import DesktopProductCard from "../components/DesktopProductCard";

interface DesktopHomeProps {
  products?: Product[];
  onProduct?: (product: Product) => void;
  onCatalog?: () => void;
  onCreate?: () => void;
}

export default function DesktopHome({
  products = [],
  onProduct,
  onCatalog,
  onCreate,
}: DesktopHomeProps) {
  return (
    <div className="desktop-main">

      <section className="desktop-hero">

        <div className="desktop-hero__content">

          <span className="desktop-hero__badge">
            SXRON MARKETPLACE
          </span>

          <h1>
            Покупай.
            <br />
            Продавай.
            <br />
            <span>Находи.</span>
          </h1>

          <p>
            Локальный маркетплейс
            Белореченска и Хутора
            Кубанского.
          </p>

          <div className="desktop-search">
            <input
              type="search"
              placeholder="Что вы ищете?"
            />

            <button
              type="button"
              onClick={onCatalog}
            >
              Найти
            </button>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 14,
            }}
          >
            <button
              className="desktop-button desktop-button--primary"
              type="button"
              onClick={onCatalog}
            >
              Смотреть каталог
            </button>

            <button
              className="desktop-button desktop-button--secondary"
              type="button"
              onClick={onCreate}
            >
              Подать объявление
            </button>
          </div>

        </div>

      </section>

      <section className="desktop-section">

        <div className="desktop-section__header">
          <div>
            <h2 className="desktop-section__title">
              Категории
            </h2>

            <p className="desktop-section__subtitle">
              Найдите нужное быстрее
            </p>
          </div>
        </div>

        <div className="desktop-categories">

          {[
            ["📱", "Электроника"],
            ["👕", "Одежда"],
            ["👟", "Обувь"],
            ["🚗", "Авто"],
            ["🏠", "Для дома"],
            ["💼", "Услуги"],
          ].map(([icon, name]) => (
            <div
              className="desktop-category"
              key={name}
            >
              <div className="desktop-category__icon">
                {icon}
              </div>

              <div className="desktop-category__name">
                {name}
              </div>
            </div>
          ))}

        </div>

      </section>

      <section className="desktop-section">

        <div className="desktop-section__header">
          <div>
            <h2 className="desktop-section__title">
              Свежие объявления
            </h2>

            <p className="desktop-section__subtitle">
              Новые товары на SXRON
            </p>
          </div>

          <button
            className="desktop-button desktop-button--secondary"
            type="button"
            onClick={onCatalog}
          >
            Все объявления →
          </button>
        </div>

        {products.length > 0 ? (
          <div className="desktop-products">
            {products.map((product) => (
              <DesktopProductCard
                key={product.id}
                product={product}
                onClick={onProduct}
              />
            ))}
          </div>
        ) : (
          <div className="desktop-profile__card">
            Пока объявлений нет.
          </div>
        )}

      </section>

    </div>
  );
}