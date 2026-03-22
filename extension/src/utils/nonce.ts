import { randomBytes } from "crypto";

export function getNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(32);
  let nonce = "";
  for (let i = 0; i < 32; i++) {
    nonce += chars[bytes[i] % chars.length];
  }
  return nonce;
}
