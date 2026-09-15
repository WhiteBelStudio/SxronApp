import type { Product } from "../../types";

import MobileProductCard from "../components/MobileProductCard";

interface MobileFavoritesProps {
  products: Product[];
  onProduct?: (product: Product) => void;
}

export default function MobileFavorites({
  products,
  onProduct,
}: MobileFavoritesProps) {
  return (
    <main className="mobile-page">

      <div className="mobile-page-title">
        <h1>
          Избранное
        </h1>

        <span>
          Сохранённые товары
        </span>
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
        <div className="mobile-empty mobile-empty--large">
          <div>
            ♡
          </div>

          <strong>
            Здесь пока пусто
          </strong>

          <span>
            Сохраняйте понравившиеся
            объявления.
          </span>
        </div>
      )}

    </main>
  );
}