import {
  StrictMode,
} from "react";

import {
  createRoot,
} from "react-dom/client";

import App from "./App";
import AuthGate from "./components/AuthGate";
import ForcedUpdater from "./components/ForcedUpdater";
import PublicSellerProfile from "./components/PublicSellerProfile";

import "./styles/global.css";
import "./styles/user-profile.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Не найден элемент #root.");
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthGate>
      <App />
      <ForcedUpdater />
      <PublicSellerProfile />
    </AuthGate>
  </StrictMode>,
);
