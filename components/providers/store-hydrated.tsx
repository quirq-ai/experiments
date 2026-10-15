"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";

/*
  Two step gate for every page under app/(app)/:
  1. Rehydrate the persisted local slices (sprints, OKRs, wiki, setup
     config) from localStorage.
  2. Fetch the XO snapshot so the mirror slices (issues, members,
     projects) reflect the .xo files on disk.
  Children render after both, avoiding SSR/CSR mismatches and an empty
  flash. If the snapshot fails the app still renders; syncError is set on
  the store for the UI to surface. Feature pages never need their own
  hydration or fetch logic.
*/
export function StoreHydrated({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve(useAppStore.persist.rehydrate());
      await useAppStore.getState().refreshFromXo();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
