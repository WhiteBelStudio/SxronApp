import type { Product } from "../../types";
import DesktopProductCard from "../components/DesktopProductCard";

interface DesktopProfileProps {
  products: Product[];
  onProduct?: (product: Product) => void;
  onCreate?: () => void;
}

export default function DesktopProfile({
  products,
  onProduct,
  onCreate,
}: DesktopProfileProps) {
  return (
    <div className="desktop-main">

      <div className="desktop-profile">

        <aside className="desktop-profile__card">

          <div className="desktop-profile__avatar">
            S
          </div>

          <div className="desktop-profile__name">
            Мой профиль
          </div>

          <div className="desktop-profile__username">
            SXRON пользователь
          </div>

          <button
            className="desktop-button desktop-button--primary"
            type="button"
            onClick={onCreate}
            style={{
              width: "100%",
              marginTop: 24,
            }}
          >
            + Подать объявление
          </button>

        </aside>

        <section>

          <div className="desktop-section__header">
            <div>
              <h1 className="desktop-section__title">
                Мои объявления
              </h1>

              <p className="desktop-section__subtitle">
                Управляйте своими товарами
              </p>
            </div>
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
            <div className="desktop-profile__card">
              У вас пока нет объявлений.
            </div>
          )}

        </section>

      </div>

    </div>
  );
}