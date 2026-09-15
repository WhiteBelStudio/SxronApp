import type {
  Product,
} from "../types";


interface FavoritesPageProps {
  products: Product[];

  onProduct: (
    product: Product,
  ) => void;

  onRemove: (
    productId: number,
  ) => void;
}


export function FavoritesPage({
  products,
  onProduct,
  onRemove,
}: FavoritesPageProps) {
  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <span className="section-label">
            SXRON
          </span>

          <h1>
            Избранное
          </h1>

          <p>
            Сохранённые объявления.
          </p>
        </div>
      </div>


      {products.length === 0 && (
        <div className="state-card">
          <div className="empty-icon">
            ❤️
          </div>

          <h2>
            Избранное пусто
          </h2>

          <p>
            Нажми ❤️ на объявлении,
            чтобы сохранить его.
          </p>
        </div>
      )}


      <div className="products-grid">
        {products.map(
          (product) => (
            <article
              className="product-card"
              key={product.id}
              onClick={() =>
                onProduct(product)
              }
            >
              <div className="product-image">
                {product.photo_url ? (
                  <img
                    src={
                      product.photo_url
                    }
                    alt={product.name}
                  />
                ) : (
                  <span>
                    📦
                  </span>
                )}
              </div>


              <div className="product-info">
                <span className="product-category">
                  {product.category}
                </span>

                <h2>
                  {product.name}
                </h2>

                <p>
                  {product.description}
                </p>


                <div className="product-bottom">
                  <strong>
                    {product.price.toLocaleString(
                      "ru-RU",
                    )}{" "}
                    ₽
                  </strong>


                  <button
                    onClick={(event) => {
                      event.stopPropagation();

                      onRemove(
                        product.id,
                      );
                    }}
                  >
                    💔 Убрать
                  </button>
                </div>
              </div>
            </article>
          ),
        )}
      </div>
    </main>
  );
}