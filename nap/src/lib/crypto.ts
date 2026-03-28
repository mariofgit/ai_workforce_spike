// Placeholder abstraction for Supabase Vault/KMS integration.
// For spike use only: encoded transport format, not production encryption.
export function encryptSecret(plain: string): string {
  return Buffer.from(plain, "utf8").toString("base64");
}

export function decryptSecret(blob: string): string {
  return Buffer.from(blob, "base64").toString("utf8");
}
