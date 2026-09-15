import {
  useEffect,
  useState,
} from "react";

import {
  getCategories,
  getCities,
} from "../api/api";

import {
  useProducts,
} from "../hooks/useProducts";

import type {
  Category,
  City,
  Product,
} from "../types";


interface CatalogPageProps {
  onProduct: (
    product: Product,
  ) => void;
}


// =========================================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ГОРОДА
// =========================================================

function getCityName(
  city: City | string | null | undefined,
): string {
  if (!city) {
    return "Город не указан";
  }

  if (typeof city === "string") {
    return city;
  }

  return city.name;
}


// =========================================================
// CATALOG PAGE
// =========================================================

export function CatalogPage({
  onProduct,
}: CatalogPageProps) {
  const {
    products,
    loading,
    error,

    search,
    setSearch,

    category,
    setCategory,

    city,
    setCity,

    reload,
  } = useProducts();


  // =======================================================
  // КАТЕГОРИИ
  // =======================================================

  const [
    categories,
    setCategories,
  ] = useState<Category[]>([]);


  // =======================================================
  // ГОРОДА
  // =======================================================

  const [
    cities,
    setCities,
  ] = useState<City[]>([]);


  // =======================================================
  // ЗАГРУЗКА ФИЛЬТРОВ
  // =======================================================

  useEffect(() => {
    async function loadFilters() {
      try {
        const [
          categoriesData,
          citiesData,
        ] = await Promise.all([
          getCategories(),
          getCities(),
        ]);


        setCategories(
          categoriesData,
        );

        setCities(
          citiesData,
        );
      } catch (error) {
        console.error(error);
      }
    }


    void loadFilters();
  }, []);


  // =======================================================
  // UI
  // =======================================================

  return (
    <main className="page">

      {/* =================================================
          ЗАГОЛОВОК
      ================================================= */}

      <div className="page-heading">
        <div>
          <span className="section-label">
            SXRON MARKETPLACE
          </span>

          <h1>
            Каталог
          </h1>

          <p>
            Найди нужное объявление
            в своём городе.
          </p>
        </div>


        <button
          className="secondary-button"
          onClick={() =>
            void reload()
          }
        >
          ↻ Обновить
        </button>
      </div>


      {/* =================================================
          ФИЛЬТРЫ
      ================================================= */}

      <section className="filters">

        {/* ПОИСК */}

        <div className="search-box">
          <span>
            🔎
          </span>

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Поиск объявлений..."
          />
        </div>


        {/* КАТЕГОРИЯ */}

        <select
          value={category}
          onChange={(event) =>
            setCategory(
              event.target.value,
            )
          }
        >
          <option value="">
            Все категории
          </option>

          {categories.map(
            (item) => (
              <option
                key={item.id}
                value={item.name}
              >
                {item.name}
              </option>
            ),
          )}
        </select>


        {/* ГОРОД */}

        <select
          value={city}
          onChange={(event) =>
            setCity(
              event.target.value,
            )
          }
        >
          <option value="">
            Все города
          </option>

          {cities.map(
            (item) => (
              <option
                key={item.id}
                value={item.name}
              >
                {item.name}
              </option>
            ),
          )}
        </select>

      </section>


      {/* =================================================
          ЗАГРУЗКА
      ================================================= */}

      {loading && (
        <div className="state-card">

          <div className="loading-spinner" />

          <p>
            Загружаем объявления...
          </p>

        </div>
      )}


      {/* =================================================
          ОШИБКА
      ================================================= */}

      {error && (
        <div className="state-card error-card">

          <div className="empty-icon">
            ⚠️
          </div>

          <h2>
            Ошибка
          </h2>

          <p>
            {error}
          </p>

        </div>
      )}


      {/* =================================================
          НЕТ ТОВАРОВ
      ================================================= */}

      {!loading &&
        !error &&
        products.length === 0 && (
          <div className="state-card">

            <div className="empty-icon">
              🔍
            </div>

            <h2>
              Ничего не найдено
            </h2>

            <p>
              Попробуй изменить
              параметры поиска.
            </p>

          </div>
        )}


      {/* =================================================
          КОЛИЧЕСТВО
      ================================================= */}

      {!loading &&
        !error &&
        products.length > 0 && (
          <div className="catalog-result-info">

            Найдено объявлений:{" "}

            <strong>
              {products.length}
            </strong>

          </div>
        )}


      {/* =================================================
          ТОВАРЫ
      ================================================= */}

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

              {/* =========================================
                  ФОТО
              ========================================= */}

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


              {/* =========================================
                  ИНФОРМАЦИЯ
              ========================================= */}

              <div className="product-info">

                <span className="product-category">
                  {product.category ||
                    "Без категории"}
                </span>


                <h2>
                  {product.name}
                </h2>


                <p>
                  {product.description ||
                    "Описание отсутствует."}
                </p>


                {/* =======================================
                    МЕТА
                ======================================= */}

                <div className="product-meta">

                  <span>
                    📍{" "}
                    {getCityName(
                      product.city,
                    )}
                  </span>


                  {product.condition && (
                    <span>
                      {product.condition}
                    </span>
                  )}

                </div>


                {/* =======================================
                    НИЖНЯЯ ЧАСТЬ
                ======================================= */}

                <div className="product-bottom">

                  <strong>
                    {product.price.toLocaleString(
                      "ru-RU",
                    )}{" "}
                    ₽
                  </strong>


                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();

                      onProduct(
                        product,
                      );
                    }}
                  >
                    Открыть
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