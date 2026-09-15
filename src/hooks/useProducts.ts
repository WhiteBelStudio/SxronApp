import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getProducts,
} from "../api/api";

import type {
  Product,
} from "../types";


interface UseProductsResult {
  products: Product[];
  loading: boolean;
  error: string | null;

  search: string;
  setSearch: (
    value: string,
  ) => void;

  category: string;
  setCategory: (
    value: string,
  ) => void;

  city: string;
  setCity: (
    value: string,
  ) => void;

  reload: () => Promise<void>;
}


export function useProducts():
  UseProductsResult {
  const [
    products,
    setProducts,
  ] = useState<Product[]>([]);


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );


  const [
    search,
    setSearch,
  ] = useState("");


  const [
    category,
    setCategory,
  ] = useState("");


  const [
    city,
    setCity,
  ] = useState("");


  const loadProducts =
    useCallback(
      async () => {
        try {
          setLoading(true);
          setError(null);


          const data =
            await getProducts({
              search:
                search.trim() ||
                undefined,

              category:
                category ||
                undefined,

              city:
                city ||
                undefined,
            });


          setProducts(data);
        } catch (error) {
          console.error(error);

          setError(
            error instanceof Error
              ? error.message
              : "Не удалось загрузить объявления.",
          );
        } finally {
          setLoading(false);
        }
      },
      [
        search,
        category,
        city,
      ],
    );


  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void loadProducts();
        },
        250,
      );


    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [loadProducts]);


  return {
    products,

    loading,

    error,

    search,
    setSearch,

    category,
    setCategory,

    city,
    setCity,

    reload: loadProducts,
  };
}