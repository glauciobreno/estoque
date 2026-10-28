import type { Pagina } from "@estoque/shared";

export const deslocamento = (page: number, pageSize: number) => (page - 1) * pageSize;

export const pagina = <T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): Pagina<T> => ({
  items,
  total,
  page,
  pageSize,
});
