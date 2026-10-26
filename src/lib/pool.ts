/** Maps with at most `limit` calls in flight; results keep the input order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Like Promise.allSettled + mapLimit: failures become `undefined` and are reported, not thrown. */
export async function mapSettled<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
  onError: (item: T, error: unknown) => void,
): Promise<(R | undefined)[]> {
  return mapLimit(items, limit, async (item) => {
    try {
      return await fn(item);
    } catch (e) {
      onError(item, e);
      return undefined;
    }
  });
}
