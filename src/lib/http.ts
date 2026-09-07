/**
 * A small fetch wrapper every live provider goes through, so timeouts,
 * network failures and malformed JSON turn into one predictable error type
 * instead of each provider inventing its own try/catch shape.
 */
export class ProviderHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = 'ProviderHttpError';
  }
}

export class ProviderTimeoutError extends Error {
  constructor(readonly url: string, readonly timeoutMs: number) {
    super(`Request to ${url} timed out after ${timeoutMs}ms.`);
    this.name = 'ProviderTimeoutError';
  }
}

export interface FetchJsonOptions extends RequestInit {
  /** Aborts and throws ProviderTimeoutError past this. Default 8s. */
  timeoutMs?: number;
}

/**
 * Fetch JSON with a hard timeout. Never throws a raw AbortError or a bare
 * "Unexpected token" JSON.parse error — callers (the providers) catch
 * `ProviderHttpError` / `ProviderTimeoutError` / generic `Error` and turn all
 * three into an honest `unavailable(...)`, never into fabricated data.
 */
export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { timeoutMs = 8000, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ProviderTimeoutError(url, timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new ProviderHttpError(`${response.status} ${response.statusText}`, response.status, url);
  }

  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Malformed JSON from ${url}.`);
  }
}
