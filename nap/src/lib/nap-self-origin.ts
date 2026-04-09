/**
 * Base URL for same-origin NAP API calls from Route Handlers (avoids broken localhost on Vercel).
 */
export function napSelfOrigin(): string {
  const explicit = process.env.NAP_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (explicit) {
    return explicit;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return `http://127.0.0.1:${process.env.PORT ?? 3000}`;
}
