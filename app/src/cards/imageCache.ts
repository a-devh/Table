// Card images kept on disk (the browser's Cache Storage), so an image that was
// shown once is never downloaded again: not after a new search, not after a
// restart. Each use gets its own object URL to release when done. Anything
// that goes wrong falls back to the image's own web address.
import { useEffect, useState } from 'react';

const CACHE = 'card-images';
/** Oldest images are dropped past this many (about 100 KB each). */
const MAX_IMAGES = 3000;
const TRIM_EVERY = 50;

let cache: Promise<Cache | null> | undefined;
function openCache(): Promise<Cache | null> {
  cache ??= ('caches' in window ? caches.open(CACHE) : Promise.reject(new Error('no Cache Storage'))).catch(() => null);
  return cache;
}

let added = 0;
async function trim(store: Cache) {
  const keys = await store.keys(); // oldest first
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_IMAGES)).map((k) => store.delete(k)));
}

/** In-flight downloads, so two tiles of the same image share one. */
const pending = new Map<string, Promise<Blob>>();

async function imageBlob(url: string): Promise<Blob> {
  const store = await openCache();
  const hit = await store?.match(url);
  if (hit) return hit.blob();
  let request = pending.get(url);
  if (!request) {
    request = fetch(url).then(async (res) => {
      if (!res.ok) throw new Error(`image ${res.status}`);
      if (store) {
        await store.put(url, res.clone());
        if (++added % TRIM_EVERY === 0) trim(store).catch(() => undefined);
      }
      return res.blob();
    });
    request.finally(() => pending.delete(url)).catch(() => undefined);
    pending.set(url, request);
  }
  return request;
}

/**
 * A URL for the image, from the cache when it's there. Call the returned
 * release() once the image has been drawn or is no longer shown.
 */
export async function cachedImage(url: string): Promise<{ src: string; release: () => void }> {
  try {
    const src = URL.createObjectURL(await imageBlob(url));
    return { src, release: () => URL.revokeObjectURL(src) };
  } catch {
    return { src: url, release: () => undefined };
  }
}

/** cachedImage for an <img>: undefined until it's ready. */
export function useCachedImage(url: string | undefined): string | undefined {
  const [src, setSrc] = useState<{ url: string; src: string }>();
  useEffect(() => {
    if (!url) return;
    let release: (() => void) | undefined;
    let live = true;
    cachedImage(url).then((r) => {
      if (live) {
        release = r.release;
        setSrc({ url, src: r.src });
      } else r.release();
    });
    return () => {
      live = false;
      release?.();
    };
  }, [url]);
  return src && src.url === url ? src.src : undefined;
}
