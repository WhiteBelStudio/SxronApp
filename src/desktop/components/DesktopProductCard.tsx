import type { Product } from "../../types";

interface DesktopProductCardProps {
  product: Product;
  onClick?: (product: Product) => void;
}

export default function DesktopProductCard({
  product,
  onClick,
}: DesktopProductCardProps) {
  const city =
    typeof product.city === "string"
      ? product.city
      : product.city?.name;

  const category =
    product.category ??
    "Без категории";

  return (
    <article
      className="desktop-product"
      onClick={() => onClick?.(product)}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="desktop-product__image">

        {product.photo_url ? (
          <img
            src={product.photo_url}
            alt={product.name}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              placeItems: "center",
              color: "#565d6b",
              fontSize: "40px",
            }}
          >
            S
          </div>
        )}

      </div>

      <div className="desktop-product__body">

        <div className="desktop-product__category">
          {category}
        </div>

        <div className="desktop-product__name">
          {product.name}
        </div>

        <div className="desktop-product__bottom">

          <div className="desktop-product__price">
            {product.price.toLocaleString(
              "ru-RU",
            )} ₽
          </div>

          <div className="desktop-product__city">
            {city ?? "Белореченск"}
          </div>

        </div>

      </div>
    </article>
  );
}