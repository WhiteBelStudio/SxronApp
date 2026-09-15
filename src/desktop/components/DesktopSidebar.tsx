interface DesktopSidebarProps {
  selectedCategory?: string;
  onCategoryChange?: (
    category: string,
  ) => void;
}

const categories = [
  "Все категории",
  "Электроника",
  "Одежда",
  "Обувь",
  "Авто",
  "Для дома",
  "Красота",
  "Услуги",
  "Другое",
];

export default function DesktopSidebar({
  selectedCategory = "Все категории",
  onCategoryChange,
}: DesktopSidebarProps) {
  return (
    <aside className="desktop-sidebar">

      <div className="desktop-sidebar__title">
        Категории
      </div>

      {categories.map((category) => {
        const active =
          category === selectedCategory;

        return (
          <button
            key={category}
            type="button"
            className={
              "desktop-sidebar__item" +
              (
                active
                  ? " desktop-sidebar__item--active"
                  : ""
              )
            }
            onClick={() =>
              onCategoryChange?.(category)
            }
          >
            <span>
              {category}
            </span>

            {active && (
              <span>
                ›
              </span>
            )}
          </button>
        );
      })}

    </aside>
  );
}