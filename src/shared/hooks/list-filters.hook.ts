"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

export function useListFilters<T extends Record<string, string | number | undefined>>(current: T) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function update(patch: Partial<T>) {
    const next = { ...current, page: undefined, ...patch };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value !== undefined && value !== "" && !(key === "page" && value === 1)) params.set(key, String(value));
    }
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  return { update, pending };
}
