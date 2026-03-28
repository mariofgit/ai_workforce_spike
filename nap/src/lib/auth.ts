export function requireBearer(request: Request): string {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Missing bearer token");
  }
  return normalizeToken(authHeader.replace("Bearer ", ""));
}

export function verifyServiceToken(token: string) {
  const expected = normalizeToken(process.env.NAP_SERVICE_TOKEN || "");
  if (!expected || token !== expected) {
    throw new Error("Invalid service token");
  }
}

function normalizeToken(value: string): string {
  const trimmed = value.trim();
  return trimmed.replace(/^"(.*)"$/, "$1");
}
