import { useEffect, useState } from "react";

type SxronTheme = "dark" | "light";

const STORAGE_KEY = "sxron_theme";

function getInitialTheme(): SxronTheme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme: SxronTheme) {
  document.documentElement.dataset.sxronTheme = theme;
  document.documentElement.style.colorScheme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage may be unavailable in restricted environments.
  }
}

export default function ThemeController() {
  const [theme, setTheme] = useState<SxronTheme>(() => getInitialTheme());
  const [profileVisible, setProfileVisible] = useState(false);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const syncVisibility = () => {
      setProfileVisible(Boolean(document.querySelector(".sxron-user-profile")));
    };

    syncVisibility();
    const observer = new MutationObserver(syncVisibility);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!profileVisible) return null;

  const nextTheme: SxronTheme = theme === "dark" ? "light" : "dark";

  return (
    <div className="sxron-theme-switcher" role="group" aria-label="Тема приложения">
      <span className="sxron-theme-switcher__label">Тема</span>
      <button
        type="button"
        className={`sxron-theme-switcher__button sxron-theme-switcher__button--${theme}`}
        onClick={() => setTheme(nextTheme)}
        aria-label={`Переключить на ${nextTheme === "light" ? "светлую" : "тёмную"} тему`}
        title={`Переключить на ${nextTheme === "light" ? "светлую" : "тёмную"} тему`}
      >
        <span>{theme === "dark" ? "☾" : "☀"}</span>
        <b>{theme === "dark" ? "Тёмная" : "Светлая"}</b>
      </button>
    </div>
  );
}
