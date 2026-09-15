interface AppHeaderProps {
  onHome: () => void;

  onCatalog: () => void;

  onFavorites: () => void;

  onProfile: () => void;
}


export function AppHeader({
  onHome,
  onCatalog,
  onFavorites,
  onProfile,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <button
        className="brand"
        onClick={onHome}
      >
        <span className="brand-gradient">
          SXRON
        </span>
      </button>


      <nav className="desktop-nav">
        <button
          onClick={onHome}
        >
          Главная
        </button>


        <button
          onClick={onCatalog}
        >
          Каталог
        </button>


        <button
          onClick={onFavorites}
        >
          ❤️ Избранное
        </button>


        <button
          onClick={onProfile}
        >
          👤 Профиль
        </button>
      </nav>
    </header>
  );
}