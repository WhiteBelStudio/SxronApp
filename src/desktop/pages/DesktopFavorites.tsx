import type { Product } from "../../types";
import DesktopProductCard from "../components/DesktopProductCard";

interface DesktopFavoritesProps {
  products: Product[];
  onProduct?: (product: Product) => void;
}

export default function DesktopFavorites({
  products,
  onProduct,
}: DesktopFavoritesProps) {
  return (
    <div className="desktop-main">

      <div className="desktop-section__header">
        <div>
          <h1 className="desktop-section__title">
            Избранное
          </h1>

          <p className="desktop-section__subtitle">
            Сохранённые объявления
          </p>
        </div>
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
          <div
            style={{
              fontSize: 40,
              marginBottom: 16,
            }}
          >
            ♡
          </div>

          <h2>
            Здесь пока пусто
          </h2>

          <p
            style={{
              color: "#777e8d",
            }}
          >
            Добавляйте понравившиеся
            объявления в избранное.
          </p>
        </div>
      )}

    </div>
  );
}