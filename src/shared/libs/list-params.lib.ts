export const PAGE_SIZE = 20;

type SearchParams = Record<string, string | string[] | undefined>;

export function readParam(params: SearchParams, key: string) {
  const value = params[key];
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() ? first.trim().slice(0, 100) : undefined;
}

export function readPage(params: SearchParams) {
  const page = Number(readParam(params, "page"));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
