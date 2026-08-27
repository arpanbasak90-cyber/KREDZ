// Tiny SHA-256 helper using Web Crypto API
export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function shortHash(hash: string, len = 12) {
  return `${hash.slice(0, len)}…${hash.slice(-4)}`;
}
