import type { Product } from "../../types";

interface MobileProductCardProps {
  product: Product;
  onClick?: (product: Product) => void;
}

export default function MobileProductCard({
  product,
  onClick,
}: MobileProductCardProps) {
  const city =
    typeof product.city === "string"
      ? product.city
      : product.city?.name;

  return (
    <article
      className="mobile-product"
      onClick={() => onClick?.(product)}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="mobile-product__image">

        {product.photo_url ? (
          <img
            src={product.photo_url}
            alt={product.name}
          />
        ) : (
          <span>
            S
          </span>
        )}

        <button
          className="mobile-product__favorite"
          type="button"
          aria-label="Избранное"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          ♡
        </button>

      </div>

      <div className="mobile-product__body">

        <div className="mobile-product__category">
          {product.category ??
            "Без категории"}
        </div>

        <div className="mobile-product__name">
          {product.name}
        </div>

        <div className="mobile-product__bottom">

          <strong>
            {product.price.toLocaleString(
              "ru-RU",
            )} ₽
          </strong>

          <span>
            {city ?? "Белореченск"}
          </span>

        </div>

      </div>
    </article>
  );
}