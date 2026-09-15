import type { City, Page } from "../../types";

interface DesktopHeaderProps {
  page: Page;
  city: City;
  onCityChange: (city: City) => void;
  onNavigate: (page: Page) => void;
  onCreate: () => void;
}

const cities: City[] = [
  {
    id: 1,
    name: "Белореченск",
  },
  {
    id: 2,
    name: "Хутор Кубанский",
  },
];

export default function DesktopHeader({
  page,
  city,
  onCityChange,
  onNavigate,
  onCreate,
}: DesktopHeaderProps) {
  return (
    <header className="desktop-header">
      <div className="desktop-header__inner">

        <button
          className="desktop-logo"
          type="button"
          onClick={() => onNavigate("home")}
        >
          <span className="desktop-logo__mark">
            S
          </span>

          <span className="desktop-logo__text">
            SXRON
          </span>
        </button>

        <nav className="desktop-nav">

          <button
            className={`desktop-nav__item ${
              page === "home"
                ? "desktop-nav__item--active"
                : ""
            }`}
            type="button"
            onClick={() => onNavigate("home")}
          >
            Главная
          </button>

          <button
            className={`desktop-nav__item ${
              page === "catalog"
                ? "desktop-nav__item--active"
                : ""
            }`}
            type="button"
            onClick={() => onNavigate("catalog")}
          >
            Каталог
          </button>

          <button
            className={`desktop-nav__item ${
              page === "favorites"
                ? "desktop-nav__item--active"
                : ""
            }`}
            type="button"
            onClick={() => onNavigate("favorites")}
          >
            Избранное
          </button>

          <button
            className={`desktop-nav__item ${
              page === "profile"
                ? "desktop-nav__item--active"
                : ""
            }`}
            type="button"
            onClick={() => onNavigate("profile")}
          >
            Профиль
          </button>

        </nav>

        <div className="desktop-city">
          <select
            className="desktop-city__select"
            value={city.id}
            onChange={(event) => {
              const nextCity = cities.find(
                (item) =>
                  item.id === Number(
                    event.target.value,
                  ),
              );

              if (nextCity) {
                onCityChange(nextCity);
              }
            }}
          >
            {cities.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <button
          className="desktop-header__action"
          type="button"
          onClick={onCreate}
        >
          + Подать объявление
        </button>

      </div>
    </header>
  );
}