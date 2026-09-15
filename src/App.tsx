/// <reference types="vite/client" />

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import type {
  City,
  Page,
  Product,
} from "./types";

/* =========================================================
   DESKTOP
   ========================================================= */

import DesktopHeader from "./desktop/components/DesktopHeader";
import DesktopFooter from "./desktop/components/DesktopFooter";

import DesktopHome from "./desktop/pages/DesktopHome";
import DesktopCatalog from "./desktop/pages/DesktopCatalog";
import DesktopFavorites from "./desktop/pages/DesktopFavorites";
import DesktopProfile from "./desktop/pages/DesktopProfile";

/* =========================================================
   MOBILE
   ========================================================= */

import MobileHeader from "./mobile/components/MobileHeader";
import MobileBottomNav from "./mobile/components/MobileBottomNav";

import MobileHome from "./mobile/pages/MobileHome";
import MobileCatalog from "./mobile/pages/MobileCatalog";
import MobileFavorites from "./mobile/pages/MobileFavorites";
import MobileProfile from "./mobile/pages/MobileProfile";

/* =========================================================
   STYLES
   ========================================================= */

import "./styles/global.css";
import "./desktop/styles/desktop.css";
import "./mobile/styles/mobile.css";


/* =========================================================
   APP
   ========================================================= */

export default function App() {

  /* =======================================================
     PAGE
     ======================================================= */

  const [
    page,
    setPage,
  ] = useState<Page>("home");


  /* =======================================================
     DEVICE
     ======================================================= */

  const [
    isMobile,
    setIsMobile,
  ] = useState<boolean>(() => {

    if (
      typeof window === "undefined"
    ) {
      return false;
    }

    return window.innerWidth <= 768;
  });


  /* =======================================================
     CITY
     ======================================================= */

  const [
    city,
    setCity,
  ] = useState<City>({
    id: 1,
    name: "Белореченск",
  });


  /* =======================================================
     FAVORITES
     ======================================================= */

  const [
    favoriteProducts,
  ] = useState<Product[]>([]);


  /* =======================================================
     RESPONSIVE
     ======================================================= */

  useEffect(() => {

    const handleResize = () => {

      setIsMobile(
        window.innerWidth <= 768,
      );

    };

    handleResize();

    window.addEventListener(
      "resize",
      handleResize,
    );

    return () => {

      window.removeEventListener(
        "resize",
        handleResize,
      );

    };

  }, []);


  /* =======================================================
     NAVIGATION
     ======================================================= */

  const goPage = useCallback(
    (nextPage: Page) => {

      setPage(nextPage);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

    },
    [],
  );


  /* =======================================================
     CITY
     ======================================================= */

  const handleCityChange = useCallback(
    (nextCity: City) => {

      setCity(nextCity);

    },
    [],
  );


  /* =======================================================
     PRODUCT
     ======================================================= */

  const handleProduct = useCallback(
    (product: Product) => {

      console.log(
        "Открытие товара:",
        product,
      );

    },
    [],
  );


  /* =======================================================
     CREATE
     ======================================================= */

  const handleCreate = useCallback(
    () => {

      /*
       * Пока отдельной страницы
       * создания объявления нет.
       *
       * Открываем профиль.
       */

      goPage("profile");

    },
    [goPage],
  );


  /* =======================================================
     PRODUCTS
     ======================================================= */

  /*
   * Временно товаров нет.
   *
   * После подключения API
   * здесь появятся реальные товары.
   */

  const products: Product[] = [];


  /* =======================================================
     MOBILE
     ======================================================= */

  if (isMobile) {

    return (
      <div className="mobile-app">

        <MobileHeader
          city={city}
          onCityChange={
            handleCityChange
          }
        />


        <main className="mobile-app__content">

          {page === "home" && (
            <MobileHome
              products={products}
              onProduct={
                handleProduct
              }
              onCatalog={() =>
                goPage("catalog")
              }
              onCreate={
                handleCreate
              }
            />
          )}


          {page === "catalog" && (
            <MobileCatalog
              products={products}
              onProduct={
                handleProduct
              }
            />
          )}


          {page === "favorites" && (
            <MobileFavorites
              products={
                favoriteProducts
              }
              onProduct={
                handleProduct
              }
            />
          )}


          {page === "profile" && (
            <MobileProfile
              products={[]}
              onProduct={
                handleProduct
              }
              onCreate={
                handleCreate
              }
            />
          )}

        </main>


        <MobileBottomNav
          page={page}
          onChange={goPage}
        />

      </div>
    );
  }


  /* =======================================================
     DESKTOP
     ======================================================= */

  return (
    <div className="desktop-app">

      <DesktopHeader
        page={page}
        city={city}
        onCityChange={
          handleCityChange
        }
        onNavigate={
          goPage
        }
        onCreate={
          handleCreate
        }
      />


      {page === "home" && (
        <DesktopHome
          products={products}
          onProduct={
            handleProduct
          }
          onCatalog={() =>
            goPage("catalog")
          }
          onCreate={
            handleCreate
          }
        />
      )}


      {page === "catalog" && (
        <DesktopCatalog
          products={products}
          onProduct={
            handleProduct
          }
        />
      )}


      {page === "favorites" && (
        <DesktopFavorites
          products={
            favoriteProducts
          }
          onProduct={
            handleProduct
          }
        />
      )}


      {page === "profile" && (
        <DesktopProfile
          products={[]}
          onProduct={
            handleProduct
          }
          onCreate={
            handleCreate
          }
        />
      )}


      <DesktopFooter />

    </div>
  );
}