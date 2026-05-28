export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}
