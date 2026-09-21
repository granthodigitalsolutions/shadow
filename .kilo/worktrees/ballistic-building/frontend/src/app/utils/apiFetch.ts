/**
 * fetch() + res.json() everywhere in the app assumed the backend always
 * answers with JSON. When VITE_API_BASE_URL isn't set at build time (e.g. a
 * Vercel deploy missing the env var), `${backendUrl}/api/...` silently
 * becomes a same-origin relative path on the frontend's own domain, which
 * has no such route — the platform returns its 404 HTML page instead of
 * JSON. `res.json()` then throws a raw `SyntaxError: Unexpected token 'T',
 * "The page c"... is not valid JSON`, which bubbled straight into a toast,
 * confusing and meaningless to a user.
 *
 * fetchJson() reads the response as text first, so a non-JSON body (an HTML
 * error page, an empty response, a proxy error) always turns into a clean,
 * readable Error instead of a raw parser exception. It intentionally does
 * NOT throw on a non-2xx status with a valid JSON body — callers keep their
 * existing `if (!ok || !data.success)` logic and access to `data.code` /
 * `data.details` etc.
 */
export interface FetchJsonResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
}

export async function fetchJson<T = any>(url: string, options?: RequestInit): Promise<FetchJsonResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  const raw = await res.text();
  const contentType = res.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    throw new Error(
      res.ok
        ? 'The server sent an unexpected response. Please try again.'
        : `Server error (${res.status}). Please try again in a moment.`
    );
  }

  let data: any;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error('Received an invalid response from the server. Please try again.');
  }

  return { ok: res.ok, status: res.status, data: data as T };
}
