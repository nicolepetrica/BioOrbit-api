// src/hooks/useBookmarks.ts
import { useCallback, useEffect, useState } from "react";
import { getCookie, setSessionCookie } from "../utils/cookies";

const COOKIE_KEY = "ro_bookmarks"; // session cookie

export function useBookmarks() {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const raw = getCookie(COOKIE_KEY);
    if (!raw) return;
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) setIds(new Set(arr.map(String)));
    } catch {}
  }, []);

  const persist = useCallback((next: Set<string>) => {
    setIds(new Set(next));
    setSessionCookie(COOKIE_KEY, JSON.stringify(Array.from(next)));
  }, []);

  const isBookmarked = useCallback((id: string) => ids.has(id), [ids]);

  const toggle = useCallback((id: string) => {
    const next = new Set(ids);
    next.has(id) ? next.delete(id) : next.add(id);
    persist(next);
  }, [ids, persist]);

  const clearAll = useCallback(() => {
    persist(new Set());
  }, [persist]);

  return { ids, isBookmarked, toggle, clearAll };
}
