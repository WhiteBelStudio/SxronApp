import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import AuthGate from "./components/AuthGate";
import AdminPanel from "./components/AdminPanel";
import ForcedUpdater from "./components/ForcedUpdater";
import PublicSellerProfile from "./components/PublicSellerProfile";

import "./styles/global.css";
import "./styles/user-profile.css";

const APP_VERSION = "1.1.12";

function syncStaticVersionLabels() {
  document.title = `SXRON Marketplace ${APP_VERSION}`;
  const currentVersion = document.getElementById("sxron-current-version");
  const installedVersion = document.getElementById("sxron-installed-pill");
  if (currentVersion) currentVersion.textContent = `АКТУАЛЬНАЯ ВЕРСИЯ · ${APP_VERSION}`;
  if (installedVersion) installedVersion.textContent = `Установлена · ${APP_VERSION}`;
}

syncStaticVersionLabels();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Не найден элемент #root.");

createRoot(rootElement).render(
  <StrictMode>
    <AuthGate>
      <App />
      <AdminPanel />
      <ForcedUpdater />
      <PublicSellerProfile />
    </AuthGate>
  </StrictMode>,
);
