// src/hooks/useBookmarks.ts
import { useEffect, useState } from "react";

const STORAGE_KEY = "bookmarks:v1"; // <-- use the SAME key everywhere

export function useBookmarks() {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      setIds(new Set(Array.isArray(arr) ? arr : []));
    } catch {
      setIds(new Set());
    }
  }, []);

  const persist = (s: Set<string>) => {
    setIds(new Set(s));
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
  };

  const toggle = (id: string) => {
    const next = new Set(ids);
    next.has(id) ? next.delete(id) : next.add(id);
    persist(next);
  };

  const isBookmarked = (id: string) => ids.has(id);

  // 1-based order (insertion order), or null if not saved
  const getIndex = (id: string) => {
    const list = [...ids];
    const i = list.indexOf(id);
    return i >= 0 ? i + 1 : null;
  };

  const clearAll = () => persist(new Set());

  return { ids, toggle, isBookmarked, getIndex, clearAll };
}
