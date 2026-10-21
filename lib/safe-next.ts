// Only same-origin paths ("/create", "/profile?x=1"). Rejects "//host", "/\host",
// "https://host" and "@host", which would otherwise send users off-site.
export function safeNext(value: string | null | undefined, fallback = "/") {
  if (!value) return fallback;
  return /^\/(?![/\\])\S*$/.test(value) ? value : fallback;
}
