import type {
  City,
} from "../types";


interface HeaderProps {
  city: City;

  onCityChange: (
    city: City,
  ) => void;

  onHome: () => void;
}


function HomeIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M3 10.8L12 3L21 10.8V20C21 20.55 20.55 21 20 21H4C3.45 21 3 20.55 3 20V10.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      <path
        d="M9 21V14H15V21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}


function LocationIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M20 10C20 15 12 21 12 21C12 21 4 15 4 10C4 5.58 7.58 3 12 3C16.42 3 20 5.58 20 10Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />

      <circle
        cx="12"
        cy="10"
        r="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}


function ChevronIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 9L12 15L18 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


export default function Header({
  city,
  onCityChange,
  onHome,
}: HeaderProps) {
  return (
    <header className="sxron-header">

      <div className="sxron-header__inner">

        {/* =================================================
            LOGO
        ================================================= */}

        <button
          type="button"
          className="sxron-logo"
          onClick={onHome}
          aria-label="SXRON — главная"
        >
          <span className="sxron-logo__mark">
            S
          </span>

          <span className="sxron-logo__text">
            SXRON
          </span>
        </button>


        {/* =================================================
            DESKTOP CENTER
        ================================================= */}

        <div className="sxron-header__center">

          <div className="sxron-header__status">
            <span className="sxron-header__status-dot" />

            <span>
              MARKETPLACE
            </span>
          </div>

        </div>


        {/* =================================================
            RIGHT
        ================================================= */}

        <div className="sxron-header__actions">

          <label
            className="sxron-city"
            htmlFor="sxron-city-select"
          >
            <span className="sxron-city__icon">
              <LocationIcon />
            </span>

            <span className="sxron-city__content">
              <span className="sxron-city__label">
                Город
              </span>

              <select
                id="sxron-city-select"
                value={city.id}
                onChange={(event) => {
                  const nextId =
                    Number(
                      event.target.value,
                    );

                  onCityChange({
                    ...city,
                    id: nextId,
                    name:
                      event.target
                        .selectedOptions[0]
                        ?.text ??
                      city.name,
                  });
                }}
              >
                <option value={city.id}>
                  {city.name}
                </option>
              </select>
            </span>

            <span className="sxron-city__chevron">
              <ChevronIcon />
            </span>
          </label>


          {/* =================================================
              HOME
          ================================================= */}

          <button
            type="button"
            className="sxron-home-button"
            onClick={onHome}
            aria-label="На главную"
          >
            <HomeIcon />

            <span>
              Главная
            </span>
          </button>

        </div>

      </div>

    </header>
  );
}