import { useSuspenseQuery } from "@tanstack/react-query";
import { brandsQuery, type Brand } from "@/lib/brands";

export function useBrands(): Brand[] {
  const { data } = useSuspenseQuery(brandsQuery());
  return data;
}
