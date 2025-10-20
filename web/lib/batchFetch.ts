/**
 * Executes async operations in batches with a configurable concurrency limit.
 * Prevents overwhelming the browser and server with too many simultaneous requests.
 *
 * @param items - Array of items to process
 * @param processor - Async function to process each item
 * @param options - Configuration options
 * @returns Promise that resolves when all items are processed
 *
 * @example
 * ```ts
 * const results = await batchFetch(
 *   connectorNames,
 *   async (name) => fetchConnectorDetails(name),
 *   { concurrency: 10 }
 * );
 * ```
 */
export async function batchFetch<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options: {
    concurrency?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<R[]> {
  const { concurrency = 10, onProgress } = options;

  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let currentIndex = 0;
  let completedCount = 0;

  // Worker function that processes items from the queue
  const worker = async (): Promise<void> => {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      const item = items[index];

      try {
        results[index] = await processor(item, index);
      } catch (error) {
        // Re-throw the error with the index for better debugging
        throw new Error(
          `Batch processing failed at index ${index}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      completedCount++;
      if (onProgress) {
        onProgress(completedCount, items.length);
      }
    }
  };

  // Create worker pool
  const workerCount = Math.min(concurrency, items.length);
  const workers = Array.from({ length: workerCount }, () => worker());

  // Wait for all workers to complete
  await Promise.all(workers);

  return results;
}

/**
 * Variant of batchFetch that collects both successful results and errors.
 * Useful when you want to continue processing even if some items fail.
 *
 * @example
 * ```ts
 * const {successes, failures} = await batchFetchSettled(
 *   connectorNames,
 *   async (name) => fetchConnectorDetails(name),
 *   { concurrency: 10 }
 * );
 * ```
 */
export async function batchFetchSettled<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options: {
    concurrency?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<{
  successes: Array<{ index: number; item: T; result: R }>;
  failures: Array<{ index: number; item: T; error: Error }>;
}> {
  const { concurrency = 10, onProgress } = options;

  if (items.length === 0) {
    return { successes: [], failures: [] };
  }

  const successes: Array<{ index: number; item: T; result: R }> = [];
  const failures: Array<{ index: number; item: T; error: Error }> = [];

  let currentIndex = 0;
  let completedCount = 0;

  const worker = async (): Promise<void> => {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      const item = items[index];

      try {
        const result = await processor(item, index);
        successes.push({ index, item, result });
      } catch (error) {
        failures.push({
          index,
          item,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }

      completedCount++;
      if (onProgress) {
        onProgress(completedCount, items.length);
      }
    }
  };

  const workerCount = Math.min(concurrency, items.length);
  const workers = Array.from({ length: workerCount }, () => worker());

  await Promise.all(workers);

  // Sort by original index to maintain order
  successes.sort((a, b) => a.index - b.index);
  failures.sort((a, b) => a.index - b.index);

  return { successes, failures };
}
