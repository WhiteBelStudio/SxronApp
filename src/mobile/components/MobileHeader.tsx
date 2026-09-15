import type { City } from "../../types";

interface MobileHeaderProps {
  city: City;
  onCityChange: (city: City) => void;
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

export default function MobileHeader({
  city,
  onCityChange,
}: MobileHeaderProps) {
  return (
    <header className="mobile-header">

      <div className="mobile-header__top">

        <div className="mobile-logo">
          <span className="mobile-logo__mark">
            S
          </span>

          <span className="mobile-logo__text">
            SXRON
          </span>
        </div>

        <button
          className="mobile-header__notification"
          type="button"
          aria-label="Уведомления"
        >
          ♢
        </button>

      </div>

      <label className="mobile-city">

        <span>
          📍
        </span>

        <select
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

      </label>

    </header>
  );
}