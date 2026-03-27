export type FetcherOptions = {
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
};

export async function fetcher(input: RequestInfo, init?: RequestInit, opts: FetcherOptions = {}) {
  const { timeoutMs = 8000, retries = 1, headers = {} } = opts;

  const mergedInit = { ...(init || {}), headers: { ...(init?.headers || {}), ...headers } } as RequestInit;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(input, { ...mergedInit, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (attempt >= retries) throw err;
      // small backoff
      await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
    }
  }
}
