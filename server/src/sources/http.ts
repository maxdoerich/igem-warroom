export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Minimal counting semaphore to cap concurrent requests per host. */
export class Semaphore {
  private queue: (() => void)[] = [];
  private active = 0;
  private readonly max: number;

  constructor(max: number) {
    this.max = max;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }
}

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(status: number, url: string, body: string) {
    super(`HTTP ${status} for ${url}: ${body.slice(0, 200)}`);
    this.status = status;
    this.url = url;
  }
}

/** Run `fn` over `items` with at most `concurrency` in flight; collects per-item errors instead of throwing. */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<{ results: (R | undefined)[]; errors: { item: T; error: unknown }[] }> {
  const results: (R | undefined)[] = new Array(items.length);
  const errors: { item: T; error: unknown }[] = [];
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i], i);
      } catch (error) {
        errors.push({ item: items[i], error });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return { results, errors };
}
