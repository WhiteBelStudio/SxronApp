import {
  useMemo,
  useState,
} from "react";

import type { Product } from "../../types";

import DesktopProductCard from "../components/DesktopProductCard";
import DesktopSidebar from "../components/DesktopSidebar";

interface DesktopCatalogProps {
  products: Product[];
  onProduct?: (product: Product) => void;
}

export default function DesktopCatalog({
  products,
  onProduct,
}: DesktopCatalogProps) {
  const [
    category,
    setCategory,
  ] = useState("Все категории");

  const [
    search,
    setSearch,
  ] = useState("");

  const filteredProducts = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return products.filter((product) => {
      const productCategory =
        product.category ??
        "Без категории";

      const categoryMatch =
        category === "Все категории" ||
        productCategory === category;

      const searchMatch =
        !query ||
        product.name
          .toLowerCase()
          .includes(query) ||
        product.description
          .toLowerCase()
          .includes(query);

      return (
        categoryMatch &&
        searchMatch
      );
    });
  }, [
    products,
    category,
    search,
  ]);

  return (
    <div className="desktop-main">

      <div className="desktop-section__header">
        <div>
          <h1 className="desktop-section__title">
            Каталог
          </h1>

          <p className="desktop-section__subtitle">
            {filteredProducts.length} объявлений
          </p>
        </div>
      </div>

      <div className="desktop-search">
        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value,
            )
          }
          placeholder="Поиск по объявлениям..."
        />
      </div>

      <div
        className="desktop-catalog-layout"
        style={{ marginTop: 24 }}
      >
        <DesktopSidebar
          selectedCategory={category}
          onCategoryChange={
            setCategory
          }
        />

        <div className="desktop-products">
          {filteredProducts.map(
            (product) => (
              <DesktopProductCard
                key={product.id}
                product={product}
                onClick={onProduct}
              />
            ),
          )}
        </div>
      </div>

    </div>
  );
}