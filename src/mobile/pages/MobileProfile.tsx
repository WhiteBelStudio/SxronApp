import type { Product } from "../../types";

import MobileProductCard from "../components/MobileProductCard";

interface MobileProfileProps {
  products: Product[];
  onProduct?: (product: Product) => void;
  onCreate?: () => void;
}

export default function MobileProfile({
  products,
  onProduct,
  onCreate,
}: MobileProfileProps) {
  return (
    <main className="mobile-page">

      <section className="mobile-profile">

        <div className="mobile-profile__avatar">
          S
        </div>

        <h1>
          Мой профиль
        </h1>

        <span>
          SXRON пользователь
        </span>

        <button
          type="button"
          onClick={onCreate}
        >
          + Подать объявление
        </button>

      </section>

      <section className="mobile-section">

        <div className="mobile-section__header">
          <div>
            <h2>
              Мои объявления
            </h2>

            <span>
              Ваши товары
            </span>
          </div>
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
            У вас пока нет объявлений
          </div>
        )}

      </section>

    </main>
  );
}