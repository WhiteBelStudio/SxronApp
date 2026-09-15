interface HomePageProps {
  onCatalog: () => void;
  onCreate: () => void;
}


export function HomePage({
  onCatalog,
  onCreate,
}: HomePageProps) {
  return (
    <main className="page">
      <section className="hero">
        <div className="hero-content">
          <span className="hero-badge">
            SXRON MARKETPLACE
          </span>


          <h1>
            Покупай.
            <br />

            Продавай.
            <br />

            <span className="gradient-text">
              Находи.
            </span>
          </h1>


          <p>
            Современный маркетплейс
            для Белореченска,
            Хутора Кубанского
            и других городов.
          </p>


          <div className="hero-actions">
            <button
              className="primary-button"
              onClick={onCatalog}
            >
              Открыть каталог
            </button>


            <button
              className="secondary-button hero-secondary"
              onClick={onCreate}
            >
              + Подать объявление
            </button>
          </div>
        </div>
      </section>


      <section className="features">
        <article className="feature-card">
          <div className="feature-icon">
            🔎
          </div>

          <h3>
            Быстрый поиск
          </h3>

          <p>
            Ищи объявления по
            названию, категории
            и городу.
          </p>
        </article>


        <article className="feature-card">
          <div className="feature-icon">
            ❤️
          </div>

          <h3>
            Избранное
          </h3>

          <p>
            Сохраняй интересные
            объявления.
          </p>
        </article>


        <article className="feature-card">
          <div className="feature-icon">
            📍
          </div>

          <h3>
            Разные города
          </h3>

          <p>
            Города хранятся отдельно
            и могут расширяться.
          </p>
        </article>
      </section>
    </main>
  );
}