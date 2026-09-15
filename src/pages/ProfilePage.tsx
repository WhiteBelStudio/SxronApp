import {
  useState,
} from "react";

import {
  createProduct,
  getCities,
  getCategories,
} from "../api/api";

import type {
  Category,
  City,
  Product,
} from "../types";


interface ProfilePageProps {
  myProducts: Product[];

  onCreated: (
    product: Product,
  ) => void;

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
// PROFILE PAGE
// =========================================================

export function ProfilePage({
  myProducts,
  onCreated,
  onProduct,
}: ProfilePageProps) {

  // =======================================================
  // СОЗДАНИЕ
  // =======================================================

  const [
    creating,
    setCreating,
  ] = useState(false);


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
  // НАЗВАНИЕ
  // =======================================================

  const [
    name,
    setName,
  ] = useState("");


  // =======================================================
  // ОПИСАНИЕ
  // =======================================================

  const [
    description,
    setDescription,
  ] = useState("");


  // =======================================================
  // КАТЕГОРИЯ
  // =======================================================

  const [
    category,
    setCategory,
  ] = useState("");


  // =======================================================
  // ГОРОД
  // =======================================================

  const [
    city,
    setCity,
  ] = useState("Белореченск");


  // =======================================================
  // ЦЕНА
  // =======================================================

  const [
    price,
    setPrice,
  ] = useState("");


  // =======================================================
  // СОСТОЯНИЕ
  // =======================================================

  const [
    condition,
    setCondition,
  ] = useState("");


  // =======================================================
  // ДОСТАВКА
  // =======================================================

  const [
    delivery,
    setDelivery,
  ] = useState("");


  // =======================================================
  // ФОТО
  // =======================================================

  const [
    photoUrl,
    setPhotoUrl,
  ] = useState("");


  // =======================================================
  // ОШИБКА
  // =======================================================

  const [
    error,
    setError,
  ] = useState("");


  // =======================================================
  // ОТКРЫТЬ ФОРМУ СОЗДАНИЯ
  // =======================================================

  async function openCreateForm() {
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


      // ---------------------------------------------------
      // ПЕРВАЯ КАТЕГОРИЯ
      // ---------------------------------------------------

      if (
        categoriesData.length > 0
      ) {
        setCategory(
          categoriesData[0].name,
        );
      }


      // ---------------------------------------------------
      // ПЕРВЫЙ ГОРОД
      // ---------------------------------------------------

      if (
        citiesData.length > 0
      ) {
        setCity(
          citiesData[0].name,
        );
      }


      setError("");

      setCreating(true);

    } catch {
      setError(
        "Не удалось загрузить данные формы.",
      );
    }
  }


  // =======================================================
  // СОЗДАНИЕ ОБЪЯВЛЕНИЯ
  // =======================================================

  async function submit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    setError("");


    // ---------------------------------------------------
    // НАЗВАНИЕ
    // ---------------------------------------------------

    if (!name.trim()) {
      setError(
        "Введите название объявления.",
      );

      return;
    }


    // ---------------------------------------------------
    // ЦЕНА
    // ---------------------------------------------------

    const numericPrice =
      Number(
        price.replace(
          ",",
          ".",
        ),
      );


    if (
      !Number.isFinite(
        numericPrice,
      ) ||
      numericPrice < 0
    ) {
      setError(
        "Введите корректную цену.",
      );

      return;
    }


    // ---------------------------------------------------
    // СОЗДАНИЕ
    // ---------------------------------------------------

    try {
      const product =
        await createProduct({
          name: name.trim(),

          description:
            description.trim(),

          category,

          city,

          price:
            numericPrice,

          condition:
            condition.trim(),

          delivery:
            delivery.trim(),

          photo_url:
            photoUrl.trim() ||
            null,
        });


      // -------------------------------------------------
      // УВЕДОМЛЯЕМ APP
      // -------------------------------------------------

      onCreated(product);


      // -------------------------------------------------
      // ОЧИСТКА ФОРМЫ
      // -------------------------------------------------

      setName("");

      setDescription("");

      setPrice("");

      setCondition("");

      setDelivery("");

      setPhotoUrl("");

      setError("");

      setCreating(false);

    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось создать объявление.",
      );
    }
  }


  // =======================================================
  // ФОРМА СОЗДАНИЯ
  // =======================================================

  if (creating) {
    return (
      <main className="page">

        {/* =================================================
            ЗАГОЛОВОК
        ================================================= */}

        <div className="page-heading">

          <div>

            <span className="section-label">
              SXRON
            </span>

            <h1>
              Новое объявление
            </h1>

            <p>
              После отправки объявление
              попадёт на модерацию.
            </p>

          </div>


          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setCreating(false);
              setError("");
            }}
          >
            ← Назад
          </button>

        </div>


        {/* =================================================
            ФОРМА
        ================================================= */}

        <form
          className="create-form"
          onSubmit={submit}
        >

          {/* ОШИБКА */}

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}


          {/* НАЗВАНИЕ */}

          <label>
            Название

            <input
              value={name}
              onChange={(event) =>
                setName(
                  event.target.value,
                )
              }
              placeholder="Например: iPhone 15"
              maxLength={200}
            />
          </label>


          {/* ОПИСАНИЕ */}

          <label>
            Описание

            <textarea
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value,
                )
              }
              placeholder="Расскажи о товаре..."
              maxLength={4000}
              rows={5}
            />
          </label>


          {/* КАТЕГОРИЯ + ГОРОД */}

          <div className="form-grid">

            <label>
              Категория

              <select
                value={category}
                onChange={(event) =>
                  setCategory(
                    event.target.value,
                  )
                }
              >

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
            </label>


            <label>
              Город

              <select
                value={city}
                onChange={(event) =>
                  setCity(
                    event.target.value,
                  )
                }
              >

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
            </label>

          </div>


          {/* ЦЕНА + СОСТОЯНИЕ */}

          <div className="form-grid">

            <label>
              Цена

              <input
                value={price}
                onChange={(event) =>
                  setPrice(
                    event.target.value,
                  )
                }
                placeholder="0"
                inputMode="decimal"
              />
            </label>


            <label>
              Состояние

              <input
                value={condition}
                onChange={(event) =>
                  setCondition(
                    event.target.value,
                  )
                }
                placeholder="Новое / Б/У"
              />
            </label>

          </div>


          {/* ДОСТАВКА */}

          <label>
            Доставка

            <input
              value={delivery}
              onChange={(event) =>
                setDelivery(
                  event.target.value,
                )
              }
              placeholder="Самовывоз / доставка"
            />
          </label>


          {/* ФОТО */}

          <label>
            Ссылка на фотографию

            <input
              value={photoUrl}
              onChange={(event) =>
                setPhotoUrl(
                  event.target.value,
                )
              }
              placeholder="https://..."
            />
          </label>


          {/* SUBMIT */}

          <button
            className="primary-button"
            type="submit"
          >
            Отправить на модерацию
          </button>

        </form>

      </main>
    );
  }


  // =======================================================
  // ПРОФИЛЬ
  // =======================================================

  return (
    <main className="page">

      {/* =================================================
          ЗАГОЛОВОК
      ================================================= */}

      <div className="page-heading">

        <div>

          <span className="section-label">
            SXRON
          </span>

          <h1>
            Профиль
          </h1>

          <p>
            Управление твоими
            объявлениями.
          </p>

        </div>


        <button
          type="button"
          className="primary-button"
          onClick={() =>
            void openCreateForm()
          }
        >
          + Объявление
        </button>

      </div>


      {/* =================================================
          ПРОФИЛЬ
      ================================================= */}

      <section className="profile-card">

        <div className="profile-avatar">
          S
        </div>

        <div>

          <h2>
            Пользователь SXRON
          </h2>

          <p>
            Здесь позже подключим
            авторизацию через Telegram.
          </p>

        </div>

      </section>


      {/* =================================================
          МОИ ОБЪЯВЛЕНИЯ
      ================================================= */}

      <section className="my-products-section">

        <div className="section-header">

          <div>

            <span className="section-label">
              МОИ ОБЪЯВЛЕНИЯ
            </span>

            <h2>
              Мои объявления
            </h2>

          </div>

        </div>


        {/* =================================================
            НЕТ ОБЪЯВЛЕНИЙ
        ================================================= */}

        {myProducts.length === 0 ? (
          <div className="state-card">

            <div className="empty-icon">
              📦
            </div>

            <h2>
              Объявлений пока нет
            </h2>

            <p>
              Создай своё первое
              объявление.
            </p>

          </div>
        ) : (

          /* =================================================
             СПИСОК ОБЪЯВЛЕНИЙ
          ================================================= */

          <div className="products-grid">

            {myProducts.map(
              (product) => (
                <article
                  className="product-card"
                  key={product.id}
                  onClick={() =>
                    onProduct(
                      product,
                    )
                  }
                >

                  {/* =======================================
                      ФОТО
                  ======================================= */}

                  <div className="product-image">

                    {product.photo_url ? (
                      <img
                        src={
                          product.photo_url
                        }
                        alt={
                          product.name
                        }
                      />
                    ) : (
                      <span>
                        📦
                      </span>
                    )}

                  </div>


                  {/* =======================================
                      ИНФОРМАЦИЯ
                  ======================================= */}

                  <div className="product-info">

                    <span className="product-category">
                      {product.status ||
                        "Без статуса"}
                    </span>


                    <h2>
                      {product.name}
                    </h2>


                    <div className="product-bottom">

                      <strong>
                        {product.price.toLocaleString(
                          "ru-RU",
                        )}{" "}
                        ₽
                      </strong>


                      <span>
                        {getCityName(
                          product.city,
                        )}
                      </span>

                    </div>

                  </div>

                </article>
              ),
            )}

          </div>
        )}

      </section>

    </main>
  );
}