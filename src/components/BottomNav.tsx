import type {
  Page,
} from "../types";


interface BottomNavProps {
  page: Page;

  onChange: (
    page: Page,
  ) => void;
}


function HomeIcon({
  active,
}: {
  active: boolean;
}) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M3 10.8L12 3L21 10.8V20C21 20.55 20.55 21 20 21H4C3.45 21 3 20.55 3 20V10.8Z"
        stroke="currentColor"
        strokeWidth={active ? "2.1" : "1.7"}
        strokeLinejoin="round"
      />

      <path
        d="M9 21V14H15V21"
        stroke="currentColor"
        strokeWidth={active ? "2.1" : "1.7"}
        strokeLinejoin="round"
      />
    </svg>
  );
}


function CatalogIcon({
  active,
}: {
  active: boolean;
}) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="4"
        y="4"
        width="6"
        height="6"
        rx="1.2"
        stroke="currentColor"
        strokeWidth={active ? "2.1" : "1.7"}
      />

      <rect
        x="14"
        y="4"
        width="6"
        height="6"
        rx="1.2"
        stroke="currentColor"
        strokeWidth={active ? "2.1" : "1.7"}
      />

      <rect
        x="4"
        y="14"
        width="6"
        height="6"
        rx="1.2"
        stroke="currentColor"
        strokeWidth={active ? "2.1" : "1.7"}
      />

      <rect
        x="14"
        y="14"
        width="6"
        height="6"
        rx="1.2"
        stroke="currentColor"
        strokeWidth={active ? "2.1" : "1.7"}
      />
    </svg>
  );
}


function HeartIcon({
  active,
}: {
  active: boolean;
}) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M20.84 8.61C20.84 5.61 18.58 3.5 15.8 3.5C14.18 3.5 12.72 4.27 12 5.43C11.28 4.27 9.82 3.5 8.2 3.5C5.42 3.5 3.16 5.61 3.16 8.61C3.16 13.48 8.32 17.03 12 20.5C15.68 17.03 20.84 13.48 20.84 8.61Z"
        stroke="currentColor"
        strokeWidth={active ? "1.3" : "1.7"}
        strokeLinejoin="round"
      />
    </svg>
  );
}


function ProfileIcon({
  active,
}: {
  active: boolean;
}) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="8"
        r="3.5"
        stroke="currentColor"
        strokeWidth={active ? "2.1" : "1.7"}
      />

      <path
        d="M5 20C5.8 16.7 8.1 15 12 15C15.9 15 18.2 16.7 19 20"
        stroke="currentColor"
        strokeWidth={active ? "2.1" : "1.7"}
        strokeLinecap="round"
      />
    </svg>
  );
}


function PlusIcon() {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 5V19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <path
        d="M5 12H19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}


interface NavItemProps {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}


function NavItem({
  active,
  label,
  onClick,
  children,
}: NavItemProps) {
  return (
    <button
      type="button"
      className={
        active
          ? "sxron-nav__item sxron-nav__item--active"
          : "sxron-nav__item"
      }
      onClick={onClick}
      aria-current={
        active
          ? "page"
          : undefined
      }
    >
      <span className="sxron-nav__icon">
        {children}
      </span>

      <span className="sxron-nav__label">
        {label}
      </span>
    </button>
  );
}


export default function BottomNav({
  page,
  onChange,
}: BottomNavProps) {

  return (
    <nav
      className="sxron-bottom-nav"
      aria-label="Основная навигация"
    >

      <div className="sxron-bottom-nav__inner">

        <NavItem
          active={page === "home"}
          label="Главная"
          onClick={() =>
            onChange("home")
          }
        >
          <HomeIcon
            active={
              page === "home"
            }
          />
        </NavItem>


        <NavItem
          active={page === "catalog"}
          label="Каталог"
          onClick={() =>
            onChange("catalog")
          }
        >
          <CatalogIcon
            active={
              page === "catalog"
            }
          />
        </NavItem>


        {/* =================================================
            CENTER ADD BUTTON
        ================================================= */}

        <button
          type="button"
          className="sxron-nav__create"
          onClick={() =>
            onChange("profile")
          }
          aria-label="Подать объявление"
        >
          <span className="sxron-nav__create-icon">
            <PlusIcon />
          </span>

          <span className="sxron-nav__create-label">
            Подать
          </span>
        </button>


        <NavItem
          active={page === "favorites"}
          label="Избранное"
          onClick={() =>
            onChange("favorites")
          }
        >
          <HeartIcon
            active={
              page === "favorites"
            }
          />
        </NavItem>


        <NavItem
          active={page === "profile"}
          label="Профиль"
          onClick={() =>
            onChange("profile")
          }
        >
          <ProfileIcon
            active={
              page === "profile"
            }
          />
        </NavItem>

      </div>

    </nav>
  );
}