/// <reference types="vite/client" />
import { useCallback, useEffect, useState } from "react";
import type { City, Page, Product, ProfileCustomization } from "./types";
import DesktopHeader from "./desktop/components/DesktopHeader";
import DesktopFooter from "./desktop/components/DesktopFooter";
import DesktopHome from "./desktop/pages/DesktopHome";
import DesktopCatalog from "./desktop/pages/DesktopCatalog";
import DesktopFavorites from "./desktop/pages/DesktopFavorites";
import DesktopProfile from "./desktop/pages/DesktopProfile";
import MobileHeader from "./mobile/components/MobileHeader";
import MobileBottomNav from "./mobile/components/MobileBottomNav";
import MobileHome from "./mobile/pages/MobileHome";
import MobileCatalog from "./mobile/pages/MobileCatalog";
import MobileFavorites from "./mobile/pages/MobileFavorites";
import MobileProfile from "./mobile/pages/MobileProfile";
import "./styles/global.css";
import "./desktop/styles/desktop.css";
import "./mobile/styles/mobile.css";

const DEFAULT_PROFILE: ProfileCustomization = {
  displayName: "",
  bio: "",
  avatar: "✦",
  accent: "cyan",
  usernameVisible: true,
  badgesVisible: true,
};

function loadProfile(): ProfileCustomization {
  try {
    const raw = localStorage.getItem("sxron_profile_customization");
    return raw ? { ...DEFAULT_PROFILE, ...JSON.parse(raw) } : DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= 768);
  const [city, setCity] = useState<City>({ id: 1, name: "Белореченск" });
  const [favoriteProducts] = useState<Product[]>([]);
  const [profile, setProfile] = useState<ProfileCustomization>(() => loadProfile());

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    try { localStorage.setItem("sxron_profile_customization", JSON.stringify(profile)); } catch { /* storage unavailable */ }
  }, [profile]);

  useEffect(() => {
    document.documentElement.dataset.sxronAccent = profile.accent;
  }, [profile.accent]);

  const goPage = useCallback((nextPage: Page) => {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleProduct = useCallback((product: Product) => console.log("Открытие товара:", product), []);
  const handleCreate = useCallback(() => goPage("profile"), [goPage]);
  const products: Product[] = [];

  if (isMobile) {
    return <div className="mobile-app">
      <MobileHeader city={city} onCityChange={setCity} />
      <main className="mobile-app__content">
        {page === "home" && <MobileHome products={products} onProduct={handleProduct} onCatalog={() => goPage("catalog")} onCreate={handleCreate} />}
        {page === "catalog" && <MobileCatalog products={products} onProduct={handleProduct} />}
        {page === "favorites" && <MobileFavorites products={favoriteProducts} onProduct={handleProduct} />}
        {page === "profile" && <MobileProfile products={[]} profile={profile} onProfileChange={setProfile} onProduct={handleProduct} onCreate={handleCreate} />}
      </main>
      <MobileBottomNav page={page} onChange={goPage} />
    </div>;
  }

  return <div className="desktop-app">
    <DesktopHeader page={page} city={city} onCityChange={setCity} onNavigate={goPage} onCreate={handleCreate} />
    {page === "home" && <DesktopHome products={products} onProduct={handleProduct} onCatalog={() => goPage("catalog")} onCreate={handleCreate} />}
    {page === "catalog" && <DesktopCatalog products={products} onProduct={handleProduct} />}
    {page === "favorites" && <DesktopFavorites products={favoriteProducts} onProduct={handleProduct} />}
    {page === "profile" && <DesktopProfile products={[]} profile={profile} onProfileChange={setProfile} onProduct={handleProduct} onCreate={handleCreate} />}
    <DesktopFooter />
  </div>;
}
