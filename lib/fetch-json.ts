/**
 * fetch() wrapper for the app's JSON API: resolves with the parsed body, and
 * rejects when the request fails or the server answers with an error status,
 * so callers cannot mistake a failed save for a successful one.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchJson<T = any>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.error ?? `Request failed with status ${res.status}`)
  }
  return data as T
}
