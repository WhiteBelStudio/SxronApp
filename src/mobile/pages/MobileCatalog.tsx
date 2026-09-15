import {
  useMemo,
  useState,
} from "react";

import type { Product } from "../../types";

import MobileProductCard from "../components/MobileProductCard";
import MobileSearch from "../components/MobileSearch";

interface MobileCatalogProps {
  products: Product[];
  onProduct?: (product: Product) => void;
}

export default function MobileCatalog({
  products,
  onProduct,
}: MobileCatalogProps) {
  const [
    search,
    setSearch,
  ] = useState("");

  const filteredProducts =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return products;
      }

      return products.filter(
        (product) =>
          product.name
            .toLowerCase()
            .includes(query) ||
          product.description
            .toLowerCase()
            .includes(query),
      );
    }, [
      products,
      search,
    ]);

  return (
    <main className="mobile-page">

      <div className="mobile-page-title">
        <h1>
          Каталог
        </h1>

        <span>
          {filteredProducts.length}
          {" "}
          объявлений
        </span>
      </div>

      <MobileSearch
        value={search}
        onChange={setSearch}
      />

      <div className="mobile-filter-row">

        <button
          type="button"
        >
          Категория
        </button>

        <button
          type="button"
        >
          Цена
        </button>

        <button
          type="button"
        >
          Фильтры
        </button>

      </div>

      {filteredProducts.length > 0 ? (
        <div className="mobile-products">
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
        <div className="mobile-empty">
          Ничего не найдено
        </div>
      )}

    </main>
  );
}