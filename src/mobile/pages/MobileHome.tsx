import type { Product } from "../../types";

import MobileProductCard from "../components/MobileProductCard";
import MobileSearch from "../components/MobileSearch";

interface MobileHomeProps {
  products?: Product[];
  onProduct?: (product: Product) => void;
  onCatalog?: () => void;
  onCreate?: () => void;
}

export default function MobileHome({
  products = [],
  onProduct,
  onCatalog,
  onCreate,
}: MobileHomeProps) {
  return (
    <main className="mobile-page">

      <section className="mobile-hero">

        <span className="mobile-hero__badge">
          SXRON MARKETPLACE
        </span>

        <h1>
          Всё рядом.
          <br />
          <span>Всё проще.</span>
        </h1>

        <p>
          Покупайте и продавайте
          в Белореченске.
        </p>

        <MobileSearch
          onSubmit={onCatalog}
        />

      </section>

      <section className="mobile-section">

        <div className="mobile-section__header">
          <div>
            <h2>
              Категории
            </h2>

            <span>
              Найдите нужное
            </span>
          </div>

          <button
            type="button"
            onClick={onCatalog}
          >
            Все →
          </button>
        </div>

        <div className="mobile-categories">

          {[
            ["📱", "Электроника"],
            ["👕", "Одежда"],
            ["👟", "Обувь"],
            ["🚗", "Авто"],
            ["🏠", "Дом"],
            ["💼", "Услуги"],
          ].map(([icon, name]) => (
            <button
              type="button"
              className="mobile-category"
              key={name}
              onClick={onCatalog}
            >
              <span>
                {icon}
              </span>

              <strong>
                {name}
              </strong>
            </button>
          ))}

        </div>

      </section>

      <section className="mobile-section">

        <div className="mobile-section__header">
          <div>
            <h2>
              Новые объявления
            </h2>

            <span>
              Только что добавили
            </span>
          </div>

          <button
            type="button"
            onClick={onCatalog}
          >
            Все →
          </button>
        </div>

        {products.length > 0 ? (
          <div className="mobile-products">
            {products.map((product) => (
              <MobileProductCard
                key={product.id}
                product={product}
                onClick={onProduct}
              />
            ))}
          </div>
        ) : (
          <div className="mobile-empty">
            Пока нет объявлений
          </div>
        )}

      </section>

      <button
        className="mobile-create-button"
        type="button"
        onClick={onCreate}
      >
        + Подать объявление
      </button>

    </main>
  );
}