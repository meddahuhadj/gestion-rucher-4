import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
      // TODO(v3) : brancher un persister IndexedDB pour le cache offline (§15).
    },
  },
});
