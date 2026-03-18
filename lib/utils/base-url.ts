/**
 * Returns the base URL for server-to-server API calls.
 * In self-hosted mode, uses localhost to avoid DNS/TLS issues
 * when the container can't reach itself via the public hostname.
 */
export function getInternalBaseUrl(): string {
  if (process.env.SELF_HOSTED === "1") {
    return `http://localhost:${process.env.PORT || 3000}`;
  }
  return process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
}
