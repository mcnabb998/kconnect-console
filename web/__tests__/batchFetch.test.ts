import { batchFetch, batchFetchSettled } from '@/lib/batchFetch';

describe('batchFetch', () => {
  it('should process all items with default concurrency', async () => {
    const items = [1, 2, 3, 4, 5];
    const processor = jest.fn(async (item: number) => item * 2);

    const results = await batchFetch(items, processor);

    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(processor).toHaveBeenCalledTimes(5);
  });

  it('should respect concurrency limit', async () => {
    const items = Array.from({ length: 50 }, (_, i) => i + 1);
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const processor = async (item: number) => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      // Simulate async work
      await new Promise(resolve => setTimeout(resolve, 10));
      currentConcurrent--;
      return item * 2;
    };

    await batchFetch(items, processor, { concurrency: 5 });

    // Max concurrent should never exceed 5
    expect(maxConcurrent).toBeLessThanOrEqual(5);
    expect(maxConcurrent).toBeGreaterThan(1); // Should actually run in parallel
  });

  it('should maintain order of results', async () => {
    const items = [5, 3, 1, 4, 2];

    const processor = async (item: number) => {
      // Add variable delay to test order preservation
      await new Promise(resolve => setTimeout(resolve, item * 5));
      return item;
    };

    const results = await batchFetch(items, processor, { concurrency: 3 });

    expect(results).toEqual([5, 3, 1, 4, 2]);
  });

  it('should call onProgress callback', async () => {
    const items = [1, 2, 3, 4, 5];
    const processor = async (item: number) => item * 2;
    const onProgress = jest.fn();

    await batchFetch(items, processor, { concurrency: 2, onProgress });

    expect(onProgress).toHaveBeenCalledTimes(5);
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 5);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 5);
    expect(onProgress).toHaveBeenNthCalledWith(3, 3, 5);
    expect(onProgress).toHaveBeenNthCalledWith(4, 4, 5);
    expect(onProgress).toHaveBeenNthCalledWith(5, 5, 5);
  });

  it('should handle empty array', async () => {
    const processor = jest.fn();
    const results = await batchFetch([], processor);

    expect(results).toEqual([]);
    expect(processor).not.toHaveBeenCalled();
  });

  it('should handle single item', async () => {
    const processor = async (item: number) => item * 2;
    const results = await batchFetch([42], processor);

    expect(results).toEqual([84]);
  });

  it('should throw error if processor fails', async () => {
    const items = [1, 2, 3];
    const processor = async (item: number) => {
      if (item === 2) {
        throw new Error('Processing failed');
      }
      return item * 2;
    };

    await expect(batchFetch(items, processor)).rejects.toThrow(
      /Batch processing failed at index 1: Processing failed/
    );
  });

  it('should receive index in processor function', async () => {
    const items = ['a', 'b', 'c'];
    const processor = jest.fn(async (item: string, index: number) => `${item}-${index}`);

    const results = await batchFetch(items, processor);

    expect(results).toEqual(['a-0', 'b-1', 'c-2']);
    expect(processor).toHaveBeenNthCalledWith(1, 'a', 0);
    expect(processor).toHaveBeenNthCalledWith(2, 'b', 1);
    expect(processor).toHaveBeenNthCalledWith(3, 'c', 2);
  });

  it('should handle concurrency greater than item count', async () => {
    const items = [1, 2, 3];
    const processor = async (item: number) => item * 2;

    const results = await batchFetch(items, processor, { concurrency: 10 });

    expect(results).toEqual([2, 4, 6]);
  });

  it('should process items in batches with concurrency=1', async () => {
    const items = [1, 2, 3, 4, 5];
    const processingOrder: number[] = [];

    const processor = async (item: number) => {
      processingOrder.push(item);
      await new Promise(resolve => setTimeout(resolve, 10));
      return item * 2;
    };

    await batchFetch(items, processor, { concurrency: 1 });

    // With concurrency 1, should process in exact order
    expect(processingOrder).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('batchFetchSettled', () => {
  it('should separate successes and failures', async () => {
    const items = [1, 2, 3, 4, 5];
    const processor = async (item: number) => {
      if (item % 2 === 0) {
        throw new Error(`Even number ${item}`);
      }
      return item * 2;
    };

    const { successes, failures } = await batchFetchSettled(items, processor);

    expect(successes).toEqual([
      { index: 0, item: 1, result: 2 },
      { index: 2, item: 3, result: 6 },
      { index: 4, item: 5, result: 10 },
    ]);

    expect(failures).toHaveLength(2);
    expect(failures[0]).toMatchObject({
      index: 1,
      item: 2,
    });
    expect(failures[0].error).toBeInstanceOf(Error);
    expect(failures[0].error.message).toBe('Even number 2');
  });

  it('should handle all failures', async () => {
    const items = [1, 2, 3];
    const processor = async () => {
      throw new Error('Always fails');
    };

    const { successes, failures } = await batchFetchSettled(items, processor);

    expect(successes).toEqual([]);
    expect(failures).toHaveLength(3);
  });

  it('should handle all successes', async () => {
    const items = [1, 2, 3];
    const processor = async (item: number) => item * 2;

    const { successes, failures } = await batchFetchSettled(items, processor);

    expect(successes).toHaveLength(3);
    expect(failures).toEqual([]);
  });

  it('should maintain order in results', async () => {
    const items = [5, 3, 1, 4, 2];
    const processor = async (item: number) => {
      // Add variable delay
      await new Promise(resolve => setTimeout(resolve, (6 - item) * 5));
      if (item === 3) throw new Error('Three fails');
      return item * 2;
    };

    const { successes, failures } = await batchFetchSettled(items, processor, { concurrency: 3 });

    // Results should be sorted by original index
    expect(successes.map(s => s.index)).toEqual([0, 2, 3, 4]);
    expect(failures.map(f => f.index)).toEqual([1]);
  });

  it('should call onProgress for both successes and failures', async () => {
    const items = [1, 2, 3, 4, 5];
    const processor = async (item: number) => {
      if (item === 3) throw new Error('Fail');
      return item * 2;
    };
    const onProgress = jest.fn();

    await batchFetchSettled(items, processor, { concurrency: 2, onProgress });

    expect(onProgress).toHaveBeenCalledTimes(5);
    expect(onProgress).toHaveBeenLastCalledWith(5, 5);
  });

  it('should handle empty array', async () => {
    const processor = jest.fn();
    const { successes, failures } = await batchFetchSettled([], processor);

    expect(successes).toEqual([]);
    expect(failures).toEqual([]);
    expect(processor).not.toHaveBeenCalled();
  });

  it('should convert non-Error to Error', async () => {
    const items = [1];
    const processor = async () => {
      // Testing error handling by throwing a non-Error value
      // This is intentional for testing purposes only
      const nonError: unknown = 'String error';
      throw nonError;
    };

    const { failures } = await batchFetchSettled(items, processor);

    expect(failures[0].error).toBeInstanceOf(Error);
    expect(failures[0].error.message).toBe('String error');
  });

  it('should respect concurrency limit even with failures', async () => {
    const items = Array.from({ length: 50 }, (_, i) => i + 1);
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const processor = async (item: number) => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      await new Promise(resolve => setTimeout(resolve, 5));
      currentConcurrent--;

      if (item % 3 === 0) {
        throw new Error('Divisible by 3');
      }
      return item * 2;
    };

    await batchFetchSettled(items, processor, { concurrency: 5 });

    expect(maxConcurrent).toBeLessThanOrEqual(5);
    expect(maxConcurrent).toBeGreaterThan(1);
  });
});
