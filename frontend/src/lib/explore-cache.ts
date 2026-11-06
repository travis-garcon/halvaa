import { mutate as globalMutate } from "swr";

const DELETED_MEMORIALS_KEY = "halvaa:deleted-memorials";
const DELETED_MEMORIAL_EVENT = "halvaa:memorial-deleted";
const EXPLORE_CACHE_NAMES = ["discover-memorials", "nearby-memorials", "landing-memorials"];

function readDeletedMemorialIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const value = JSON.parse(window.localStorage.getItem(DELETED_MEMORIALS_KEY) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

export function isMemorialLocallyDeleted(memorialId: string): boolean {
  return readDeletedMemorialIds().has(memorialId);
}

function isExploreCacheKey(key: unknown): boolean {
  const serialized = Array.isArray(key) ? String(key[0] ?? "") : String(key ?? "");
  return EXPLORE_CACHE_NAMES.some((name) => serialized.includes(name));
}

export async function invalidateExploreAfterMemorialDelete(memorialId: string): Promise<void> {
  if (typeof window !== "undefined") {
    const deleted = readDeletedMemorialIds();
    deleted.add(memorialId);
    window.localStorage.setItem(DELETED_MEMORIALS_KEY, JSON.stringify([...deleted]));
    window.dispatchEvent(new CustomEvent(DELETED_MEMORIAL_EVENT, { detail: { memorialId } }));
  }
  await globalMutate(isExploreCacheKey, undefined, { revalidate: true });
}

export function subscribeToMemorialDeletes(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handleDelete = () => callback();
  const handleStorage = (event: StorageEvent) => {
    if (event.key === DELETED_MEMORIALS_KEY) callback();
  };
  window.addEventListener(DELETED_MEMORIAL_EVENT, handleDelete);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(DELETED_MEMORIAL_EVENT, handleDelete);
    window.removeEventListener("storage", handleStorage);
  };
}
