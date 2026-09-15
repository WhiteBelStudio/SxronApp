import type { Page } from "../../types";

interface MobileBottomNavProps {
  page: Page;
  onChange: (page: Page) => void;
}

const items: Array<{
  page: Page;
  icon: string;
  label: string;
}> = [
  {
    page: "home",
    icon: "⌂",
    label: "Главная",
  },
  {
    page: "catalog",
    icon: "⌕",
    label: "Поиск",
  },
  {
    page: "favorites",
    icon: "♡",
    label: "Избранное",
  },
  {
    page: "profile",
    icon: "♙",
    label: "Профиль",
  },
];

export default function MobileBottomNav({
  page,
  onChange,
}: MobileBottomNavProps) {
  return (
    <nav className="mobile-bottom-nav">

      {items.map((item) => (
        <button
          key={item.page}
          type="button"
          className={
            "mobile-bottom-nav__item" +
            (
              page === item.page
                ? " mobile-bottom-nav__item--active"
                : ""
            )
          }
          onClick={() =>
            onChange(item.page)
          }
        >
          <span className="mobile-bottom-nav__icon">
            {item.icon}
          </span>

          <span className="mobile-bottom-nav__label">
            {item.label}
          </span>
        </button>
      ))}

    </nav>
  );
}