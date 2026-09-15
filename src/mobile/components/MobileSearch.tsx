interface MobileSearchProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
}

export default function MobileSearch({
  value = "",
  onChange,
  onSubmit,
}: MobileSearchProps) {
  return (
    <div className="mobile-search">

      <span className="mobile-search__icon">
        ⌕
      </span>

      <input
        type="search"
        value={value}
        onChange={(event) =>
          onChange?.(
            event.target.value,
          )
        }
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onSubmit?.();
          }
        }}
        placeholder="Поиск товаров..."
      />

      <button
        type="button"
        onClick={onSubmit}
      >
        Найти
      </button>

    </div>
  );
}