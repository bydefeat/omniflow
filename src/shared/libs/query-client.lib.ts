import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // Server components render fresh data; avoid an immediate refetch after hydration.
      queries: { staleTime: 30_000, refetchOnWindowFocus: false },
    },
  });
}
